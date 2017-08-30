// Profile UI
// Displays the users profile details


// Listen to signin requests
hello.on('auth.login', function(r) {
	// Get Profile
	hello( r.network ).api( '/me' ).then( function(p) {
        var label = document.getElementById(r.network);
		label.innerHTML = "<img src='"+ p.thumbnail + "' id='profileIMG'/> <p id='profileName'>"+ p.name;
		document.getElementById("savSess").innerHTML = "Saved Session";
        console.log(p);
        //creating Profile Object for MongoDB useage
        hello('google').api('me').then(function(json) {

            var SenseMapUser = {
                FirstName : json.first_name,
                LastName : json.last_name,
                email : json.email,
                picture : json.picture,
                gender : json.gender,
                language : json.language,
			}

		document.getElementById("btn_login").style.visibility = 'hidden';
		document.getElementById("btn_logout").disabled = false;
		document.getElementById("btn_logout").style.color = "darkmagenta";
		document.getElementById("btn_logout").style.visibility = 'visible';
		document.getElementById("btn_login").style.color = "red";

        //minor debug
        //console.log(SenseMapUser);
});
		// On chrome apps we're not able to get remote images
		// This is a workaround
		if (typeof(chrome) === 'object') {
			img_xhr(label.getElementsByTagName('img')[0], p.thumbnail);
		}
	});
});

/*
// Bind events to the buttons on the page
var b = Array.prototype.slice.call(document.querySelectorAll('button.profile'));
b.forEach(function(btn){
	btn.onclick = function(){
        hello(this.id).login();
	};
});

// Utility for loading the thumbnail in chromeapp
function img_xhr(img, url) {
	var xhr = new XMLHttpRequest();
	xhr.open('GET', url, true);
	xhr.responseType = 'blob';
	xhr.onload = function(e) {
		img.src = window.URL.createObjectURL(this.response);
	};
	xhr.send();
}
*/