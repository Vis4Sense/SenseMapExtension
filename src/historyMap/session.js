// Made by Reday Yahya | @RedayY
// JavaScript Document for Save and Load Control

let SessionName;
let SessionProfile;
let debug_test_result;
let recording = true; // whether new noded is added to historymap or not
let loggedIn = false; // whether user is logged in

$(function () {
    $('#btn_start').click(function () {
        recording = true;
        btnDisplay();
    });
    $('#btn_pause').click(function () {
        recording = false;
        btnDisplay();
    });
    $('#btn_new').click(function () {
        newHistoryMap();
    });
    $('#btn_load').click(function () {
        historyMap.API.DBLoad.displaySessions();
    });
    $('#btn_logout').click(function () {
        chrome.runtime.sendMessage({
            text: 'logout',
            function (response) {
                console.log('response from login.js', response.text);
            }
        });
        location.reload();
        loggedIn = false;
        btnDisplay();
    });
    $('#btn_login').click(function () {
        // run hello.js google+ login
        chrome.runtime.sendMessage({
            text: 'login',
            function (response) {
                console.log('response from login.js', response.text);
            }
        });
    });
});

window.onload = function () {
    btnDisplay();
};

chrome.runtime.onMessage.addListener(function (request) {
    if (request.text === 'loggedin') {
        loggedIn = true;
        historyMap.model.user = request.user;
    }
});

function btnDisplay() {
    // make only the relevant button visible

    if (recording) {
        document.getElementById("btn_start").style.display = "none";
        document.getElementById("btn_pause").style.display = "initial";
    } else {
        document.getElementById("btn_start").style.display = "initial";
        document.getElementById("btn_pause").style.display = "none";
    }

    if (loggedIn) {
        document.getElementById("btn_login").style.display = "none";
        document.getElementById("btn_logout").style.display = "initial";
        document.getElementById('userImage').style.display = "initial";
        userImage.src = historyMap.model.user.image.url;

        //checks if User has Sessions Saved, displays load if true

        if (typeof (SessionProfile) != 'undefined') {

            if (SessionProfile.length == 0) {
                document.getElementById("btn_load").style.display = 'none';
            } else {
                document.getElementById("btn_load").style.display = 'initial';
            }
        } else {
            document.getElementById("btn_load").style.display = 'none';
        }

    } else {
        document.getElementById("btn_login").style.display = "initial";
        document.getElementById("btn_logout").style.display = "none";
        document.getElementById("btn_load").style.display = "none";
        document.getElementById('userImage').style.display = "none";
    }
}

function newHistoryMap() {
    var confirmation = confirm("Do you want to start a new session? All the progress will be lost if you are not logged in.")

    // this message box will be updated so depends on whether user is logged in or not, different message and options (such as 'enter session name' or 'login') will be displayed.

    if (confirmation) {

        historyMap.model.nodes.empty();

        if (loggedIn) {
            // so user can't create press the 'new' button more than once.
            document.getElementById('btn_new').disabled = true;

            // add a text field
            var input = document.createElement('input');
            input.type = 'text';
            var today = new Date();
            //input.placeholder = today;
            input.value = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate() + ' ' + today.getHours() + ':' + today.getMinutes() + ':' + today.getSeconds();
            input.id = 'sessionName';
            document.getElementById('settings').appendChild(input);
            input.focus();

            // add a button
            var button = document.createElement('button');
            button.type = 'button';
            button.innerHTML = 'Create';
            button.id = 'btn_new_sess';
            document.getElementById('settings').appendChild(button);

            $(function () {
                $('#btn_new_sess').click(function () {
                    historyMap.API.DBSave.newSession();
                })
            });
        }
    }
}


//This loads the Sessions in a menu
historyMap.API.DBLoad.displaySessions = function() {

    document.getElementById("btn_load").setAttribute("disabled", "disabled");

    // Managing generated HTML Elements
    var Div = document.getElementById("Select-Option");
    var selectList = document.createElement("select");
    selectList.id = "mySelect";
    Div.appendChild(selectList);

    // Looping thorugh SessionProfile and generating selects
    for (var i = 0; i < SessionProfile.length; i++) {

        // Generating Option for Select List in combination of Data
        var option = document.createElement("option");
        option.value = SessionProfile[i]._id;
        option.text = SessionProfile[i].name;
        selectList.appendChild(option);
    };

    document.getElementById("mySelect").selectedIndex = -1;

    // Adding listener to trigger when Select makes a change also reset interface for next load
    document.getElementById("mySelect").addEventListener("change", function (e) {
        historyMap.API.DBLoad.setSelectedSession();
        document.getElementById("mySelect").remove();
        document.getElementById("btn_load").setAttribute("enabled", "enabled");
    });

    // Create event and fire it.
    var changeEvent = document.createEvent("HTMLEvents");
    changeEvent.initEvent("change", true, true);

};

historyMap.API.DBSave.newSession = function() {
    SessionName = document.getElementById('sessionName').value;
    document.getElementById("sessionName").remove();
    document.getElementById("btn_new_sess").remove();
    document.getElementById('btn_new').disabled = false;

    //Hacky way to prevent users from creating duplicate Sessions.
    //Looping thorugh SessionProfile
    if (typeof SessionProfile == 'undefined' || SessionProfile == null) {
        console.log("Saving Session: " + SessionName);
        historyMap.API.DBSave.pushSessToDB();
    } else {
        var noDuplicate = true;
        
        for (var i = 0; i < SessionProfile.length; i++) {

            //If SessionName matches a Session Generated alert the user
            if (SessionName == SessionProfile[i].name) {
                noDuplicate = false;
                window.alert("Session Name already exsits, please choose a different Session Name");
                break;
            }
        };
        if (noDuplicate) {
            //Pushes Session to DB
            console.log("Saving Session: " + SessionName);
            historyMap.API.DBSave.pushSessToDB();
        }
    }

}

//This connects to the API and loads user sessions and stores it in HistoryMapModel
historyMap.API.DBLoad.loadUserSessions = function() {
    var url = baseURL + "session/" + up.email + "/" + APIKey;
    var xhr = new XMLHttpRequest()
    xhr.open('GET', url, true)
    xhr.onload = function () {
        var users = JSON.parse(xhr.responseText);
        if (xhr.readyState == 4 && xhr.status == "200") {
            //picking out Session Information from User Account
            SessionProfile = users["sessions"];
            historyMap.model.sessions = SessionProfile;
            btnDisplay();
        } else {}
    }
    xhr.send(null);
}

//Use this function to load Sessions into history map, requires Session Data to be used.
historyMap.API.DBLoad.setSelectedSession = function() {

    //fetches value from select list
    select_Val = document.getElementById("mySelect").value;
    document.getElementById("mySelect").remove();
    document.getElementById('btn_load').disabled = false;

    for (var i = 0; i => SessionProfile.length; i++) {
        if (SessionProfile[i]._id == select_Val) {
            var result = SessionProfile[i];
            console.log(result);
            historyMap.API.DBLoad.loadSelectedSession(result);
            break;
        }
    }
}

//Function for loading
historyMap.API.DBLoad.loadSelectedSession = function(i) {

    //Clear Previous Values
    nodes.length = 0;
    SessionName = "";
    //Reload History Map
    historyMap.view.redraw();

    //Set Values to Historymap from Session of Choice for save and load
    SessionName = i.name;
    DBSessionPointer = i._id;

    //loops through node array in retrieved session object to get nodeAdditionalinfo
    //and then inserts it via += into nodes array in HistoryMap
    debug_test_result = JSON.parse(i.nodes[0].info);
    for (j = 0; j < i.nodes.length; j++) {
        //Since Nodes have been stringified while being sent to the DB, i parsed it back to an object
        var fixNodes = JSON.parse(i.nodes[j].info);
        historyMap.model.nodes.addNode(fixNodes);
    }
};

//Force logout upon closing
window.onbeforeunload = function () {
    chrome.runtime.sendMessage({
        text: 'logout',
        function (response) {
            console.log('response from login.js', response.text);
        }
    });
};