
var app = angular.module("myApp", ["ngRoute"]);

///routing system for site
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


///Controller that connects to coinmarket api...
///Currently shows 100
app.controller('customersCtrl', function($scope, $http) {
  $http.get("https://api.coinmarketcap.com/v1/ticker/").then(function (response) {
      $scope.myData = response.data;
  });
});
