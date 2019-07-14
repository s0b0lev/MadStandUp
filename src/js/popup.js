import handlers from './modules/handlers';
import msg from './modules/msg';
import form from './modules/form';
import runner from './modules/runner';
import $ from 'jquery';
import {
    get_projects,
    get_issues_with_today_worklogs
} from './api';

// here we use SHARED message handlers, so all the contexts support the same
// commands. but this is NOT typical messaging system usage, since you usually
// want each context to handle different commands. for this you don't need
// handlers factory as used below. simply create individual `handlers` object
// for each context and pass it to msg.init() call. in case you don't need the
// context to support any commands, but want the context to cooperate with the
// rest of the extension via messaging system (you want to know when new
// instance of given context is created / destroyed, or you want to be able to
// issue command requests from this context), you may simply omit the
// `handlers` parameter for good when invoking msg.init()

$(document).ready(function() {

    var serverUrl = window.localStorage.getItem('active-server-url');

    window.onbeforeunload = function () {
        return false;
    };

    // ---------- Check Validation User ---------- //
    function setUserInfo(data) {
        get_issues_with_today_worklogs().then(function (timeLogged) {
            $('#work-logged').text(timeLogged);
        });
        $('#valid-user').removeClass('block--hide');
        $('#first-step').addClass('block--hide');
        $('#userAvatar').attr("src", data['issues'][0]['fields']['assignee']['avatarUrls']['48x48']);
        $('#userName').text(data['issues'][0]['fields']['assignee']['displayName']);
        $('#userMail').text(data['issues'][0]['fields']['assignee']['emailAddress']);
        $('#jira-key').text(data['issues'][0]['key'].replace(/[^a-zA-Z]+/g, ''));
        $('#jira-key').attr('href', serverUrl);
        return userName;
    }

    function showAuthError(el) {
        $(el).removeClass('block--hide');
    }

    function hideAuthError(el) {
        $(el).addClass('block--hide');
    }
    
    async function checkValidation(data) {
        var theUrl = data.url + '/rest/api/2/search?jql=project=' + data.key + '&assignee=currentuser()';
        return new Promise(function (resolve, reject) {
            $.ajax({
                url: theUrl,
                success: function (data) {
                    resolve(data);
                },
                error: function (error) {
                    reject(error);
                }
            });
        });
    }
    // ---------- END: Check Validation User ---------- //

    // ------------ Main Function ----------- //
    function showLoader() {
        $('#loading').show();
    }

    function hideLoader() {
        $('#loading').hide();
    }

    function copyAll() {
        var copyText = document.getElementById('standup-text');
        copyText.select();
        document.execCommand('copy');
    }

    function rememberJiraUrl(data) {
        var jiraServers = JSON.parse(window.localStorage.getItem('jira-servers'));
        var server = {};
        var isValid = checkValidation(data).then(function (response) {
            if (jiraServers == null || Object.keys(jiraServers).length == 0) {
                server = {
                    0: data
                };
                window.localStorage.setItem('jira-servers', JSON.stringify(server));
                return response;
            } else {
                var keys = Object.keys(jiraServers);
                var values = Object.values(jiraServers);
                if (values.includes(data.url)) {
                    return false;
                }
                jiraServers[Number(keys[keys.length - 1]) + 1] = data;
                window.localStorage.setItem('jira-servers', JSON.stringify(jiraServers));
                return true;
            }
        }).catch(function (error) {
            return error;
        });
        return isValid;
    }
    
    function removeSavedServer(url) {
        var jiraServers = JSON.parse(window.localStorage.getItem('jira-servers'));
        var urlID = Object.keys(jiraServers).find(key => jiraServers[key].url === url);
        delete jiraServers[urlID];
        window.localStorage.setItem('jira-servers', JSON.stringify(jiraServers));
        window.localStorage.setItem('active-server-url', '');
        showSavedJiraUrl();
    }

    function getSavedJiraUrl() {
        var jiraServers = JSON.parse(window.localStorage.getItem('jira-servers'));
        if (jiraServers == null) {
            return [];
        }
        return Object.values(jiraServers);
    }

    function showSavedJiraUrl() {
        var servers = getSavedJiraUrl();
        $('#saved-servers').empty();
        if (servers.length > 0) {
            for (let i = 0; i < servers.length; i++) {
                $('#saved-servers').append(
                    "<p class='http-error please-auth block--hide'>Please, login to the link!</p>" +
                    "<div class='servers-btn'>" +
                        "<button class='saved-servers__btn' value='" + JSON.stringify({ url: servers[i].url, key: servers[i].key }) + "'>"
                            + servers[i].name +
                        "</button>" +
                        "<button class='remove-servers-btn' value='"
                            + servers[i].url + "'>" +
                            "<img src='../images/bucket.svg' alt='Remove'>" +
                        "</button>" +
                    "</div>"
                );
            }
        } else {
            $('#saved-servers').html(
                '<h5 class="saved-servers--empty">Server list is empty</h5>'
            );
            window.localStorage.setItem('active-server-url', '');
            return false;
        }
    }

    $('#saved-servers').on('click', function (e) {
        if (e.target.className == 'saved-servers__btn') {
            var value = JSON.parse(e.target.value);
            showLoader();
            checkValidation(value).then(function (data) {
                hideLoader();
                window.localStorage.setItem('active-server-url', JSON.stringify(value));
                setUserInfo(data);
            }).catch(function (error) {
                hideLoader();
                $(e.target).parent().prev().removeClass('block--hide');
            });
        } else if (e.target.className == 'remove-servers-btn') {
            removeSavedServer(e.target.value);
        }
    });

    $('#copyAll').on('click', function () {
        $(this).text('Copied');
        copyAll();
    });

    $('#go-auth-step').on('click', function () {
        $('#valid-user').addClass('block--hide');
        $('#projects').addClass('block--hide');
        $('#first-step').removeClass('block--hide');
        $('.add-server__desc').removeClass('block--hide');
        showSavedJiraUrl();
    });

    $('#rememberJiraUrl').on('click', function () {
        $(this).text('Saved!');
        var insertedUrl = $('#server-url').val();
        rememberJiraUrl(insertedUrl);
    });

    $('#add-server').on('click', function () {
        $('#add-server-wrap').removeClass('add-server-wrap--disable');
        $('#add-server-wrap input').focus();
        $(document).on('keyup', function(e) {
            if (e.keyCode == 13 && $('#add-server-wrap input').val() != '') {
                addNewJira();
            }
        });
    });

    $('#add-server__close').on('click', function () {
        hideAuthError('.http-error');
        $('#add-server-wrap').addClass('add-server-wrap--disable');
    });

    $('#add-server__btn').on('click', function () {
        addNewJira();
    });
    
    // ------------------ //

    $(document).on('click', function (e) {
        if (e.target.className == 'projects_item') {
            var value = JSON.parse(e.target.value);
            saveNewJira(value);
        }
    });
    
    function addNewJira() {
        var inputUrl = $('#server-url').val();
        var key = 'atlassian.net';
        var resultUrl = '';
        if (inputUrl.includes('https://pm.maddevs.co')) {
            resultUrl = 'https://pm.maddevs.co';
        }
        if (inputUrl.includes(key)) {
            var positionKey = inputUrl.indexOf(key);
            resultUrl = inputUrl.substring(0, positionKey + key.length);
        }
        showLoader();
        if (resultUrl != '') {
            get_projects(resultUrl).then(res => {
                hideLoader();
                $('.add-server__desc').addClass('block--hide');
                $('#projects').empty();
                for (let i = 0; i < res.length; i++) {
                    $('#projects').append(
                        "<button class='projects_item' value='" + JSON.stringify({
                            url: resultUrl,
                            name: res[i].name,
                            key: res[i].key
                        }) + "'>" + res[i].key + '-' + res[i].name + "</button>"
                    );
                }
            });
        } else {
            hideLoader();
            showAuthError('.incorrect-link');
        }
    }

    function saveNewJira(data) {
        showLoader();
        rememberJiraUrl(data).then(function (res) {
            if (res != false && res != undefined) {
                hideLoader();
                hideAuthError('.http-error');
                window.localStorage.setItem('active-server-url', JSON.stringify(data));
                $('#add-server-wrap input').val('');
                showUserInfoSection(data);
            } else {
                hideLoader();
                showAuthError('.url-exist');
            }
        }).catch(function (error) {
            hideLoader();
            if (error.status == 403 || error.status == 400) {
                showAuthError('.not-auth');
            } else {
                hideAuthError('.not-link');
                showAuthError('.incorrect-link');
            }
        });
    }

    function showUserInfoSection(data) {
        checkValidation(data).then(function (res) {
            hideLoader();
            setUserInfo(res);
        }).catch(function (error) {
            hideLoader();
            $('#first-step').removeClass('block--hide');
            showSavedJiraUrl();
        });
    }

    // -------------- INIT ---------------- //
    (function init() {
        showLoader();
        showUserInfoSection(serverUrl);
    })();
});

form.init(runner.go.bind(runner, msg.init('popup', handlers.create('popup'))));