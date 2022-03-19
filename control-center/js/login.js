/** Copyright (c) 2021 Mesibo
 * https://mesibo.com
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the terms and condition mentioned
 * on https://mesibo.com as well as following conditions are met:
 *
 * Redistributions of source code must retain the above copyright notice, this
 * list of conditions, the following disclaimer and links to documentation and
 * source code repository.
 *
 * Redistributions in binary form must reproduce the above copyright notice,
 * this list of conditions and the following disclaimer in the documentation
 * and/or other materials provided with the distribution.
 *
 * Neither the name of Mesibo nor the names of its contributors may be used to
 * endorse or promote products derived from this software without specific prior
 * written permission.
 *
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 *
 * Documentation
 * https://mesibo.com/documentation/
 *
 * Source Code Repository
 * https://github.com/mesibo/
 *
 *
 */


var isLoginValid = false;
var api = null;
var password = null;
var configured = false;
var status_timer = null;
var connect_timer = null;
var showing = '';
var prompt_api = '';
var foreground = true;
var last_op = null;
var login_fail_count = 0;
var refresh_interval = 5;
var onp = { token: '', host: ''};
var appdb = { dbtype: 0, dbhost: '', dbname: '', dbuser: '', dbpass: ''};

function get_value(id, defval) {
	var e = document.getElementById(id);
	if(!e) return defval;
	return e.value.trim();
}

function set_value(id, val) {
	var e = document.getElementById(id);
	if(!e) return false;
	e.value = val;
	return true;
}

function get_value_or_error(id, minlen, error) {
	var e = document.getElementById(id);

	var val = '';
	if(e) val = e.value.trim();
	if(val.length < minlen) {
		show_error(error);
		return false;
	}
	return val;
}

function check_value(id, val) {
	var e = document.getElementById(id);
	if(!e) return false;
	e.checked = val;
	return true;
}

function is_checked(id) {
	var e = document.getElementById(id);
	if(!e) return false;
	return e.checked;
}

function enable_element(id, val) {
	var e = document.getElementById(id);
	if(!e) return false;
	e.disabled = !val;
	return true;
}

function is_checked(id) {
	var e = document.getElementById(id);
	if(!e) return false;
	return e.checked;
}

function set_html_value(id, val) {
	var e = document.getElementById(id);
	if(!e) return false;
	e.innerHTML = val;
	return true;
}

function show_element(id, show) {
	if(!id)
		return;

	var e = document.getElementById(id);
	if(!e) return null;

	e.style.display = show?'block':'none';
	// elementToHide.style.visibility = 'visible';
	return e;
}

function show_inline_element(id, show) {
	if(!id)
		return;

	var e = document.getElementById(id);
	if(!e) return null;

	e.style.display = show?'inline':'none';
	// elementToHide.style.visibility = 'visible';
	return e;
}

function show_inline_block_element(id, show) {
	if(!id)
		return;

	var e = document.getElementById(id);
	if(!e) return null;

	e.style.display = show?'inline-block':'none';
	return e;
}

function show_form(id) {
	if(id == showing) return;
	var forms = ["loading", "setpass", "login", "admin", "unreachable", "configinit", "configtoken", "configdb", "confighost", "configdone"];
	forms.forEach(function(eid) {
		show_element(eid, eid == id);
	});
}
		
function show_error(error) {
	if(!error || error.length < 1) 
		show_element('error-message', false);
	else {
		set_html_value('error-message', error);
		show_element('error-message', true);
	}
}

function on_foreground(fg) {
	foreground = fg;
	if(fg && last_op == 'status' && configured) {
		get_status();
	}
}

function init_control_panel() {
	//show_form("confighost");
	//return;
	show_form("login");
	api = new MesiboBackend();
	foreground = api.setVisibilityListener(on_foreground);

	// TBD, this has to be host name
	//api.setUrl("http://127.0.0.1/control");
	api.setUrl("/control");
	

	invoke_api('init');
}

function set_password() {
	var p = get_value("password", '');
	var c = get_value("confirm", '');
	if(p.length < 6 || c.length < 6) {
		show_error("Enter a valid password (minimum 6 characters) in both the fields");
		return;
	}
	
	if(p != c) {
		show_error("Passwords do not match");
		return;
	}

	show_error(null);
	var o = {};
	o.op = "setpass";
        o.password = p;

	var self = this;
	api.send(o, 1, function(cbdata, o) {
		if(!o.result) {
			show_error("Unable to set password");
			return;
		}
		self.password = p;
		show_form("configinit");
		self.get_status();
	});
}

function login_failed(error) {
	password = null;
	show_form("login");
	show_error(error);
	return true;
}

function reconnect() {
	if(last_op) invoke_api(last_op);
}

function process_response(o) {
	if(!o) {
		if(last_op) {
			show_form("unreachable");
			connect_timer = window.setTimeout(reconnect, 5000);
		} else {
			show_error("Server is Not Reachable");
		}
		return;
	}

	if(!password) {
		show_form(o.auth?"login":"setpass");
		return;
	}

	if(!o.result) {
		var error = isset(o, 'error')?o.error:'';
		if(error == 'AUTHFAIL' || error == 'MISSINGPASS' || error == 'BADPASS') {
			login_fail_count++;
			var msg = "Login Failed: Incorrect Password";
			if(login_fail_count == 2) {
				msg = msg + "<br/><br/>If you have forgotten your password, login to the server using SSH, delete password from /etc/mesibo/mesibo-control.conf and start again.";
			}

			return login_failed(msg);
		}
		
		return show_error("Operation Failed");
	}

	login_fail_count = 0;
	show_error(null);

	configured = o.configured;

	if(!o.configured) {
		show_form("configinit");
		return;
	}

	var expiry = "Expired";

	if(o.expiry) {
		var d = new Date();
		var ts = d.getTime()+o.expiry*1000;
		d = api.timestamp_to_string(ts, false);
		expiry = d['date'] + ', ' + d['time'];
	}

	show_form("admin");
	set_html_value("state", o.state.state);
	set_html_value("substate", o.state.substate);
	set_html_value("enabled", o.state.enabled);
	set_html_value("service_expiry", expiry);
	set_html_value("service_status", o.paid?"Paid":"Free");

	var show_stop = false;
	var show_start = false;
	if('inactive' == o.state.state || 'failed' == o.state.state)
		show_start = true;
	if('active' == o.state.state && 'running' == o.state.substate)
		show_stop = true;

	show_inline_element("start_button", show_start);
	show_inline_element("stop_button", !show_start);
		
	self.schedule_status();
}

function invoke_api(op, onp, privnw) {
	if(op != 'status') refresh_interval = 5;
	var o = {};
	o.op = op;
        if(password) o.password = password;
	
	if(onp) {
		o.token = onp.token;
		o.host = onp.host;
		if(appdb.dbtype == 2)
			o.app = appdb;
		else {
			// to avoid trasmitting data
			o.app = {};
			o.app.dbtype = appdb.dbtype;
		}
	}

	if(privnw) o['private'] = privnw;

	last_op = null;
	if(op == "status" || op == "init")
		last_op = op;

	window.clearTimeout(connect_timer);

	var k  = JSON.stringify(o);

	var self = this;
	api.send(o, 1, function(cbdata, o) {
		self.process_response(o);
	});
}

function schedule_status() {
	if(!foreground || !configured) return;
	var delay = 5 + (Math.random()*refresh_interval);
	status_timer = window.setTimeout(get_status, delay*1000);
	refresh_interval++;
	if(refresh_interval > 90) refresh_interval = 90;
}

function get_status() {
	if(!password || password.length < 6)
		return;

	// cancel timer
	window.clearTimeout(status_timer)

	invoke_api('status');
}

function login() {
	var p = get_value("loginpass", '');
	if(p.length < 6) {
		show_error("Enter a valid password (minimum 6 characters)");
		return;
	}
	show_error(null);
	password = p;
	get_status();
}

function setdb(type) {
	last_op = '';
	if(type < 4) {
		appdb.dbtype = type;
		return;
	}

	if(appdb.dbtype != 2) {
		show_form("confighost");
		return;
	}
	
	var dbhost = get_value_or_error('dbhost', 5, 'Enter a valid database host');
	if(!dbhost) return;
	var dbname = get_value_or_error('dbname', 1, 'Enter a valid database name');
	if(!dbname) return;
	var dbuser = get_value_or_error('dbuser', 1, 'Enter a valid database user');
	if(!dbuser) return;
	var dbpass = get_value_or_error('dbpass', 1, 'Enter a valid database pass');
	if(!dbpass) return;
	show_error(null);
	
	var o = {};
	o.op = "verify";
        o.password = password;
        o.app = {};
        o.app.dbhost = dbhost;
        o.app.dbname = dbname;
        o.app.dbuser = dbuser;
        o.app.dbpass = dbpass;

	show_inline_block_element('db-spinner', true);
	var self = this;
	api.send(o, 1, function(cbdata, o) {
		show_inline_block_element('db-spinner', false);
		if(!o.result) {
			show_error("Something went wrong checking DB");
			return;
		}

		if(o.dbok) {
			appdb.dbhost = dbhost;
			appdb.dbname = dbname;
			appdb.dbuser = dbuser;
			appdb.dbpass = dbpass;
			show_form("confighost");
			return;
		}

		show_error(o.dberror);
	});

}

function sethost() {
	last_op = '';
	var host = get_value_or_error('host', 5, 'Enter a valid Public IP or the Hostname');
	if(!host) return;
	var o = {};
	o.op = "verify";
        o.host = host;
        o.password = password;
        o.token = onp.token;

	var self = this;
	api.send(o, 1, function(cbdata, o) {
		if(!o.result) {
			show_error("Bad Public IP or the Hostname");
			return;
		}

		if(!o.ishost) {
			onp.host = host;
			show_form("configdone");
			return;
		}

		var pip = "Is this the static public IP of this server?<br/><br/>" + o.pip;
		prompt_user("Confirm Public IP", pip, "Yes", function() {
			onp.host = host;
			show_form("configdone");
		});
	});
}

function settoken() {
	last_op = '';
	appdb.dbtype = 0;
	var token = get_value("token", '');
	if(token.length < 32) {
		show_error("Enter a valid token");
		return;
	}
	show_error(null);

	var o = {};
	o.op = "verify";
        o.token = token;
        o.password = password;

	show_inline_block_element('token-spinner', true);
	var self = this;
	api.send(o, 1, function(cbdata, o) {
		show_inline_block_element('token-spinner', false);

		if(!o.result) {
			show_error("Bad or Expired Token");
			return;
		}
		onp.token = token;
		show_form("configdb");
		if(isset(o, 'dbonp') && o.dbonp) {
			check_value('onpdb', true);
			appdb.dbtype = 1;
		} else 
			check_value('localdb', true);
	});
}

function setfirewall() {
	enable_element("start_config", is_checked("firewall"));
}

function start() {
	invoke_api('start');
}

function prompt_continue(e) {
	if(prompt_api && prompt_api.length > 2)
		invoke_api(prompt_api);
	prompt_api = null;
}

function prompt_user(title, body, action, callback) {
	var e = document.getElementById('prompt-button').onclick = callback;
	set_html_value("prompt-title", title);
	set_html_value("prompt-body", body);
	set_html_value("prompt-button", action);
	window.$('#prompt').modal('show');

}

function stop() {
	prompt_api = 'stop';
	prompt_user("Stop Server?", "This will stop the mesibo server. Your users will be disconnected and will not be able to use service.", "Continue", prompt_continue);
}

function reset_config() {
	window.clearTimeout(status_timer)
	prompt_api = 'reset';
	prompt_user("Stop Server and Reset Configuration?", "This will stop the mesibo server. Your users will be disconnected and will not be able to use service. You will have to configure the server again", "Continue", prompt_continue);
}

function config() {
	show_error(null);
	invoke_api('start', onp, true);
}

// disable mousewheel on a input number field when in focus
$('form').on('focus', 'input[type=number]', function(e) {
	$(this).on('wheel.disableScroll', function(e) {
		e.preventDefault();
	});
});
$('form').on('blur', 'input[type=number]', function(e) {
	$(this).off('wheel.disableScroll');
});

function isMobileDetected() {
	let check = false;
	(function(a) {if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4))) check = true;})(navigator.userAgent || navigator.vendor || window.opera);
	return check;
}
