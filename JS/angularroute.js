var app = angular.module("myApp", ["ngRoute"]);
app.config(function($routeProvider) {
    $routeProvider
    .when("/", {
        templateUrl : 'pages/home.html'
    })
    .when("/price", {
        templateUrl : 'pages/currencycheck.html'

    })
    .when("/login", {
        templateUrl : "pages/Login.html"
    });
});

app.controller('customersCtrl', function($scope, $http) {
  $http.get("https://api.coinmarketcap.com/v1/ticker/").then(function (response) {
      $scope.myData = response.data;
  });
});
