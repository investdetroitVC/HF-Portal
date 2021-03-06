/**
* CompanyProfileController
* @namespace app.profile.controllers
*/
(function () {
    'use strict';

    angular
    .module('app.profile.controllers')
    .controller('CompanyProfileController', CompanyProfileController)
    .controller('UpdateCompanyPasswordModalInstanceController', UpdateCompanyPasswordModalInstanceController);

    CompanyProfileController.$inject = ['$scope', '$location', 'Companies', 'User', 'Tags', 'Alert', '$modal'];

    /**
    * @namespace CompanyProfileController
    */
    function CompanyProfileController($scope, $location, Companies, User, Tags, Alert, $modal) {
        var vm = this;

        // Probably can handle this in the routes or with middleware of some kind
        if( !User.isUserLoggedIn() ) {

            //$location.path("/");
            return;
        }

        $scope.tagTransform = function (newTag) {

            var tag = {

                name: newTag
            };

            return tag;
        };

        // Make sure current user is a Company
        if(!User.isUserCompany()){
            $location.path("/profile");
            return;
        }

        $scope.tags = [];
        function getCompany() {

            var currentUser = User.getCurrentUser();

            Companies.getByUserId(currentUser.id).success(function (company) {


                for (var key in company) {
                    if (!company.hasOwnProperty(key)) continue;
                    if (company[key] === null) {
                        company[key] = "";
                    }
                }
                $scope.company = company;
                console.log( $scope.company );

                $("[name='enabled']").bootstrapSwitch({

                    onText: "Visible",
                    offText: "Hidden",
                    state: company.enabled,
                    onSwitchChange: function (event, state) {

                        company.enabled = ( state ) ? 1 : 0;
                    }
                });

                Tags.all().success(function (tags) {

                    $scope.tags = tags;
                });
            });
        }
        getCompany();
        //$scope.$on( 'loginStatusChanged',  getCompany);

        activate();

        function activate() {

            //console.log('activated profile controller!');
            //Profile.all();
        }

        /* Update password */
        $scope.updateCompanyPassword = function() {
            $scope.new_password = {};
            $scope.confirm_password = {};
            var modalInstance = $modal.open({
                templateUrl: 'source/app/profile/partials/admin/update-password-form.html',
                controller: 'UpdateCompanyPasswordModalInstanceController',
                size: 'md',
                resolve: {
                    
                }
            });
            modalInstance.result.then( function( response ) {
              $scope.new_password = {};
              $scope.confirm_password = {};
            });
        };

        $scope.update = function(company) {

            //console.log( company.tags );

            var errors = [];
            if( typeof company.bio != 'undefined' && company.bio !== null )
            {
                if (company.bio.length > 350) {
                    angular.element("#bio").addClass('error');
                    errors.push("The bio field can only be 350 characters maximum");
                }
                else {

                    angular.element("#bio").removeClass('error');
                }
            }

            if( errors.length  === 0 )
            { 
                // make sure the url starts with 'http://'
                company.website_url = User.httpify(company.website_url);

                // send companies info to API via Service
                Companies.update(company).success(function (newCompanyData) {

                    // ** Trigger Success message here
                    company = newCompanyData;

                    // hide update message
                    $("#profile-photo").find(".upload-status").hide();

                    Alert.showAlert('Your profile has been updated', 'success');
                });
            }
            else
            {
                Alert.showAlert( errors, 'error' );
            }
        };

        /** S3 File uploading **/
        $scope.getS3Key = function(){


            var files = document.getElementById("file_input").files;
            var file = files[0];

            if(file === null){

                alert("No file selected.");
            }
            else{

                get_signed_request(file);
            }
        };

        function get_signed_request(file){

            var xhr = new XMLHttpRequest();

            // Trying to prevent naming collisions by appending the unique user_id to file name
            // -- remove and save the extension - should be the last part
            // -- want to make sure we allow . in the filename outside of extension
            var pieces = file.name.split(".");
            var extension = pieces.pop();
            var file_name = pieces.join(".") + "-" + $scope.company.user_id + "." + extension;

            xhr.open("GET", "/sign_s3?file_name="+file_name+"&file_type="+file.type);
            xhr.onreadystatechange = function(){

                if(xhr.readyState === 4){

                    if(xhr.status === 200){

                        var response = JSON.parse(xhr.responseText);
                        upload_file(file, response.signed_request, response.url);
                    }
                    else{

                        alert("Could not get signed URL.");
                    }
                }
            };
            xhr.send();
        }

        function upload_file(file, signed_request, url){

            var xhr = new XMLHttpRequest();
            xhr.open("PUT", signed_request);
            xhr.setRequestHeader('x-amz-acl', 'public-read');

            $("#profile-photo").find(".uploading").show();

            xhr.onload = function() {

                if (xhr.status === 200) {

                    //  Set image preview
                    document.getElementById("preview").src = url;

                    // Update company model
                    $scope.company.image_url = url;

                    // Angular is weird when updating images that started with an empty string
                    // removing ng-hide to force update
                    $("#preview").removeClass('ng-hide');
                    $(".user-photo").find(".placeholder").hide();
                    $("#profile-photo").find(".upload-status").show();
                    $("#profile-photo").find(".uploading").hide();
                }
            };

            xhr.onerror = function() {

                alert("Could not upload file.");
            };

            xhr.send(file);
        }

    }

    UpdateCompanyPasswordModalInstanceController.$inject = ['$scope', '$modalInstance', 'User', 'Alert'];
    function UpdateCompanyPasswordModalInstanceController($scope, $modalInstance, User, Alert) {


        $scope.ok = function ok() {

            $scope.errors = [];

            // Form is being validated by angular, but leaving this just in case
            if( typeof $scope.new_password === "undefined" ) {
                $scope.errors.push( "Enter a password" );
            } else if( typeof $scope.confirm_password === "undefined" ) {
                $scope.errors.push( "Confirm your new password" );
            } else if( $scope.new_password !== $scope.confirm_password ){
                $scope.errors.push( "Passwords do not match" );
            }

            if( $scope.errors.length === 0 ){

                var admin = User.getCurrentUser();
                admin.email = admin.username;
                admin.password = $scope.new_password;
                User.update(admin).then( function( newUser ){
                    console.log("updated");
                    $modalInstance.close();
                    Alert.showAlert('Your password has been updated', 'success');
                }, function(){
                    console.log("failed");
                    $scope.errors = [ "There was a problem updating the password" ];
                    Alert.showAlert('There was a problem updating the password', 'danger');
                });

            }
        };

        $scope.cancel = function cancel() {
            $modalInstance.dismiss('cancel');
        };
    }

})();
