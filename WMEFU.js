// ==UserScript==
// @name                WME Fix UI
// @namespace           https://greasyfork.org/en/users/46070
// @description         Allows alterations to the WME UI to fix things screwed up or ignored by Waze
// @include             https://www.waze.com/editor*
// @include             https://www.waze.com/*/editor*
// @include             https://beta.waze.com/editor*
// @include             https://beta.waze.com/*/editor*
// @exclude             https://www.waze.com/*user/editor/*
// @supportURL          https://www.waze.com/forum/viewtopic.php?f=819&t=191178
// @version             2.24
// @grant               none
// ==/UserScript==

// Thanks to (in no particular order)
//    Bellhouse, Twister-UK, Timbones, Dave2084, Rickzabel, Glodenox,
//    JJohnston84, SAR85, Cardyin, JustinS83, berestovskyy

(function()
{
// global variables
var wmefu_version = "2.24";
var oldVersion;
var prefix = "WMEFU";
var tabAttempts = 0;
var wmeFUAddon;
var debug = false;
var wmeFUinitialising = true;
var URLSegments, SMSegments, PLCheckTimer;
var newZoom;
var kineticDragParams;
var yslider;
//Mutation Observer to re-hack buttons
var buttonObserver = new MutationObserver(function(mutations) {
	mutations.forEach(function(mutation) {
		if ($(mutation.target).hasClass('waze-icon-reload')){
			$('.waze-icon-reload').removeClass('reload');
			$('.waze-icon-reload span').addClass('fa fa-refresh fa-lg');
			if ($('.waze-icon-reload span')[0]) {
				$('.waze-icon-reload span')[0].innerHTML = "";
			}
		}
		else if ($(mutation.target).hasClass('waze-icon-undo')){
			$('.waze-icon-undo').removeClass('undo');
			$('.waze-icon-undo span').addClass('fa fa-undo fa-lg');
			$('.waze-icon-undo span')[0].innerHTML = "";
		}
		else if ($(mutation.target).hasClass('waze-icon-redo')){
			$('.waze-icon-redo').removeClass('redo');
			$('.waze-icon-redo span').addClass('fa fa-repeat fa-lg');
			$('.waze-icon-redo span')[0].innerHTML = "";
		}
		else if ($(mutation.target).is('#wecm-count')){
			$('#wecm-count')[0].parentElement.style.marginTop = ['11px','5px','-1px'][_inpUICompression.value];
		}
 	});
});
//for daterangepicker in Restrictions
var RestrictionObserver = new MutationObserver(function(mutations) {
	if (_cbMondayFirst.checked || _cbISODates.checked) {
		mutations.forEach(function(mutation) {
			if ($(mutation.target).hasClass('modal-content')) {
				if (mutation.addedNodes.length > 0) {
					if ($(".datepicker").length > 0) {
						var DRP = $(".datepicker")[0];
						if (_cbMondayFirst.checked && _cbISODates.checked) {
							$(DRP).data("daterangepicker").locale.firstDay = 1;
							$(DRP).data("daterangepicker").locale.daysOfWeek = ['Mo','Tu','We','Th','Fr','Sa','Su'];
							$(DRP).data("daterangepicker").locale.format = "YYYY-MM-DD";
							DRP.value = $(DRP).data("daterangepicker").startDate._i + " - " + $(DRP).data("daterangepicker").endDate._i;
						} else if (_cbMondayFirst.checked) {
							$(DRP).data("daterangepicker").locale.firstDay = 1;
							$(DRP).data("daterangepicker").locale.daysOfWeek = ['Mo','Tu','We','Th','Fr','Sa','Su'];
						} else if (_cbISODates.checked) {
							$(DRP).data("daterangepicker").locale.format = "YYYY-MM-DD";
							DRP.value = $(DRP).data("daterangepicker").startDate._i + " - " + $(DRP).data("daterangepicker").endDate._i;
						}
					}
				}
			}
	 	});
	}
});
//for daterangepicker in Closures
var ClosureObserver = new MutationObserver(function(mutations) {
	if (_cbMondayFirst.checked) {
		mutations.forEach(function(mutation) {
			if (mutation.target.className == "main") {
				if (mutation.addedNodes.length > 0) {
					if (mutation.addedNodes[0].firstChild.classList.contains("edit-closure")) {
						$(".end-date").data("daterangepicker").locale.firstDay = 1;
						$(".end-date").data("daterangepicker").locale.daysOfWeek = ['Mo','Tu','We','Th','Fr','Sa','Su'];
						$(".start-date").data("daterangepicker").locale.firstDay = 1;
						$(".start-date").data("daterangepicker").locale.daysOfWeek = ['Mo','Tu','We','Th','Fr','Sa','Su'];
					}
				}
			}
	 	});
	}
});
//Fix for date/time formats in WME released Oct/Nov 2016 - provided by Glodenox
I18n.translations[I18n.currentLocale()].time = {};
I18n.translations[I18n.currentLocale()].time.formats = {};
I18n.translations[I18n.currentLocale()].time.formats.long = "%a %b %d %Y, %H:%M";
I18n.translations[I18n.currentLocale()].date.formats = {};
I18n.translations[I18n.currentLocale()].date.formats.long = "%a %b %d %Y, %H:%M";
I18n.translations[I18n.currentLocale()].date.formats.default = "%a %b %d %Y";
if (I18n.currentLocale() == 'en-GB') {
  I18n.translations['en-GB'].update_requests.panel.reported = 'Reported on: %{date}';
}
// Set the "Chat is here!" message to be hidden
if (localStorage.hiddenMessages) {
	var hm = JSON.parse(localStorage.hiddenMessages);
	if (hm.chat_intro_tip === false) {
		logit("Hiding Chat is Here! message","info");
		hm.chat_intro_tip = true;
		localStorage.setItem('hiddenMessages', JSON.stringify(hm));
	}
}

function init1() {
	console.group(prefix + ": initialising...");
	console.time(prefix + ": initialisation time");
	logit("Starting init1","debug");
	// go round again if map container isn't there yet
	if(!window.W.map) {
		logit("waiting for WME...","warning");
		setTimeout(init1, 200);
		return;
	}
	// Set flags for changing items in WME by checking the existence of elements
	newZoom = ((document.getElementById("overlay-buttons") === null) ? false : true);
	// create tab content and store it
	wmeFUAddon = createAddon();
	// insert the content as a tab
	addMyTab(null,0);
	//pass control to init2
	init2();
}

function init2() {
	logit("Starting init2","debug");
	//go round again if my tab isn't there yet
	if (!getId('sidepanel-FixUI')) {
		logit("Waiting for my tab to appear...","warning");
		setTimeout(init2, 200);
		return;
	}
	// setup event handlers for my controls:
	getId('_cbMoveZoomBar').onclick = createZoomBar;
	getId('_cbHideUserInfo').onclick = hideUserInfo;
	getId('_cbFixExternalProviders').onclick = fixExternalProviders;
	getId('_cbMoveChatIcon').onclick = moveChatIcon;
	getId('_cbHighlightInvisible').onclick = highlightInvisible;
	getId('_cbDarkenSaveLayer').onclick = darkenSaveLayer;
	getId('_cbSwapRoadsGPS').onclick = swapRoadsGPS;
	getId('_cbUndarkenAerials').onclick = undarkenAerials;
	getId('_cbShowMapBlockers').onclick = showMapBlockers;
	getId('_cbHideLinks').onclick = hideLinks;
	getId('_cbShrinkTopBars').onclick = shrinkTopBars;
	getId('_cbCompressSegmentTab').onclick = compressSegmentTab;
	getId('_cbCompressLayersMenu').onclick = compressLayersMenu;
	getId('_cbLayersColumns').onclick = compressLayersMenu;
	getId('_cbRestyleReports').onclick = restyleReports;
	getId('_cbEnhanceChat').onclick = enhanceChat;
	getId('_cbNarrowSidePanel').onclick = narrowSidePanel;
	getId("_inpUICompression").onchange = applyEnhancements;
	getId("_inpUIContrast").onchange = applyEnhancements;
	getId("_inpASX").onchange = shiftAerials;
	getId("_inpASX").onwheel = shiftAerials;
	getId("_inpASY").onchange = shiftAerials;
	getId("_inpASY").onwheel = shiftAerials;
	getId("_inpASO").onchange = shiftAerials;
	getId("_inpASO").onwheel = shiftAerials;
	getId("_resetAS").onclick = function() {
		 getId("_inpASX").value = 0;
		 getId("_inpASY").value = 0;
		 shiftAerials();
		};
	getId("_inpGSVContrast").onchange = adjustGSV;
	getId("_inpGSVBrightness").onchange = adjustGSV;
	getId("_cbGSVInvert").onchange = adjustGSV;
	getId("_cbFixBridgeButton").onchange = fixBridgeButton;
	getId("_cbDisableBridgeButton").onchange = disableBridgeButton;
	getId("_btnKillNode").onclick = killNode;
	getId("_cbDisableKinetic").onclick = disableKinetic;
	getId("_cbDisableScrollZoom").onclick = disableScrollZoom;

	//REGISTER WAZE EVENT HOOKS
	// event to recreate my tab when MTE mode is exited
	W.app.modeController.model.bind('change:mode', addMyTab);
	// event to recreate my tab after changing WME units
	W.prefs.on('change:isImperial', function() {
		tabAttempts = 0;
		tabsLooper();
	});
	// events for Aerial Shifter
	W.map.events.register("zoomend", null, shiftAerials);
	W.map.events.register("moveend", null, shiftAerials);
	W.map.baseLayer.events.register("loadend", null, shiftAerials);
	// events to change menu bar color based on map comments checkbox
	W.map.events.register("zoomend", null, warnCommentsOff);
	W.map.events.register("moveend", null, warnCommentsOff);
	// event to re-hack my zoom bar if it's there
	W.map.baseLayer.events.register("loadend", null, ZLI);
	//window resize event to resize chat
	window.addEventListener('resize', enhanceChat, true);
	//window resize event to resize layers menu
	window.addEventListener('resize', compressLayersMenu, true);
	//event to re-hack toolbar buttons when exitine HN mode
	W.editingMediator.on('change:editingHouseNumbers', function() {
		if (W.editingMediator.attributes.editingHouseNumbers === false) {
			setTimeout(hackToolbarButtons,5000);
		}
	});
	//create Aerial Shifter warning div
	ASwarning = document.createElement('div');
	ASwarning.id = "WMEFU_AS";
	ASwarning.style.top = "20px";
	ASwarning.style.left = "0px";
	ASwarning.style.width = "100%";
	ASwarning.style.position = "absolute";
	ASwarning.style.zIndex = "10000";
	ASwarning.style.fontSize = "100px";
	ASwarning.style.fontWeight = "900";
	ASwarning.style.color = "rgba(255,255,0,0.4)";
	ASwarning.style.textAlign = "center";
	ASwarning.style.pointerEvents = "none";
	ASwarning.style.display = "none";
	ASwarning.innerHTML = "Aerials Shifted";
	getId("WazeMap").appendChild(ASwarning);

	loadSettings();
	// Add an extra checkbox so I can test segment panel changes easily
	if (W.loginManager.user.userName == 'iainhouse') {
		logit("creating segment detail debug checkbox","info");
		var extraCBSection = document.createElement('p');
		extraCBSection.innerHTML = '<input type="checkbox" id="_cbextraCBSection" />';
		getId('brand').appendChild(extraCBSection);
		getId('_cbextraCBSection').onclick = FALSEcompressSegmentTab;
		getId('_cbextraCBSection').checked = getId('_cbCompressSegmentTab').checked;
		//completely disable save overlay: experimental feature
		addGlobalStyle('#popup-overlay { display: none !important; }');
	}
	//create Panel Swap div
	var WMEPS_div = document.createElement('div');
	WMEPS_div.id = "WMEFUPS";
	WMEPS_div.style.margin = "0 10px";
	WMEPS_div.style.fontSize = "20px";
	WMEPS_div.style.color = "lightgrey";
	WMEPS_div.title = "Panel Swap: when map elements are selected, this lets you\n" +
					"swap between the edit panel and the other tabs.";
	WMEPS_div.classList.add("fa");
	WMEPS_div.classList.add("fa-sticky-note");
	getId('brand').appendChild(WMEPS_div);
	// overload the window unload function to save my settings
	window.addEventListener("beforeunload", saveSettings, false);
	if (!W.selectionManager.getSelectedFeatures) {
		W.selectionManager.getSelectedFeatures = W.selectionManager.getSelectedItems;
	}
	getId("WMEFUPS").onclick = PSclicked;
	W.selectionManager.events.register("selectionchanged", null, PSicon);
	// warn of permalink segments not all selected
	if (getId("_cbPermalinkChecker").checked) {
		URLSegments = window.location.search.match(new RegExp("[?&]segments?=([^&]*)"));
		if (URLSegments) {
			//Call the check if nothing gets selected after 10 seconds
			PLCheckTimer = setTimeout(permalinkCheck, 10000);
			//Call the check when something is selected. This will either be triggerd by WME loading or
			//if nothing gets selected on load, by the user selecting something
			W.selectionManager.events.register("selectionchanged", null, permalinkCheck);
			URLSegments = URLSegments[1].split(',');
		}
	}
	// Alert to new version
	if (oldVersion != wmefu_version) {
		alert("WME Fix UI has been updated to version " + wmefu_version + "\n" +
		ChromeWarning() +
		"\n" +
		"Version 2.24 - 2018-08-15\n" +
		"* Quick fix for new WME save menu\n" +
		"\n" +
		"Previous V2 highlights:\n" +
		"* 2.22 New Feature: Integration of WME Panel Swap\n" +
		"* 2.20 New Feature: Warning for shifted aerials\n" +
		"* 2.20 New Feature: Disable scroll-to-zoom\n" +
		"* 2.18 New Feature: Create Zoom bar from scratch\n" +
		"* 2.18 New Feature: Disable Kinetic Panning\n" +
		"* 2.16 New Feature: Temporarily hide junction nodes\n" +
		"* 2.14 New Feature: Fix/disable Bridge button\n" +
		"* 2.14 New Feature: Start calendars on Monday\n" +
		"* 2.14 New Feature: ISO dates in Restrictions dialogue\n" +
		"* 2.13 New feature: Highlight Invisible mode\n" +
		"* 2.11 New feature: Show map-blocking WME bugs\n" +
		"* 2.10 New features: Enhanced Feed refresh\n" +
		"* 2.9 New feature: Fix GSV marker position\n" +
		"* 2.8 New feature: Un-darken map layer\n" +
		"* 2.7 New feature: Move GPS layer below segments\n" +
		"* 2.6 New feature: Enhance Chat panel\n" +
		"* 2.4 Recovery from unit change & house number mode implemented\n" +
		"* 2.3 The zoom bar is back, with permanent level indicator\n" +
		"* 2.2 New feature: Darken screen overlay when saving\n" +
		"* 2.0 New operation with variable & independent compression/contrast control\n" +
		"ALL FUNCTIONS NOW RE-WRITTEN FOR WME v2\n" +
		"");
		saveSettings();
	}

	// fix for sidebar display problem in Safari, requested by edsonajj
	var isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
	if (isSafari) {
		addGlobalStyle('.flex-parent { height: 99% !important; }');
	}
	// apply the settings
	shiftAerials();
	setTimeout(applyAllSettings, 1000);
	logit("Initialisation complete");
	console.timeEnd(prefix + ": initialisation time");
	console.groupEnd();
}

function createAddon() {
	//create the contents of my side-panel tab
	var addon = document.createElement('section');
	var section = document.createElement('p');
	addon.id = "sidepanel-FixUI";
	section.style.paddingTop = "4px";
	section.style.lineHeight = "11px";
	section.style.fontSize = "11px";
	section.id = "fuContent";
	section.innerHTML = "";
	section.innerHTML += '<b title="Shift aerial images layer to match GPS tracks and reduce image opacity">Aerial Shifter</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';
	section.innerHTML += '<span class="fa fa-power-off" id="_resetAS" title="Clear X/Y offsets"></span><br>';
	section.innerHTML += '<div style="display:inline-block"><input type="number" id="_inpASX" title="horizontal shift" max=100 min=-100 step=5 style="height:20px; width:47px;text-align:right;"/><b>m</b><span class="fa fa-arrow-right"></span></div>';
	section.innerHTML += '<div id="as2" style="display:inline-block;padding:0 5px;"><input type="number" id="_inpASY" title="vertical shift" max=100 min=-100 step=5 style="height:20px; width:47px;text-align:right;"/><b>m</b><span class="fa fa-arrow-up"></span></div>';
	section.innerHTML += '<div id="as3" style="display:inline-block"><input type="number" id="_inpASO" title="opacity" max=100 min=0 step=10 style="height:20px; width:44px;text-align:right;"/><b>%</b><span class="fa fa-adjust"></span></div>';
	section.innerHTML += '<br>';
	section.innerHTML += '<br>';

	section.innerHTML += '<b title="Adjust contrast & brightness for Google Street View images">GSV image adjust</b><br>';
	section.innerHTML += '<span title="Contrast"><input type="number" id="_inpGSVContrast" max=200 min=0 step=25 style="height:20px; width:47px;text-align:right;"/><b>%</b><span class="fa fa-adjust"></span></span>&nbsp;&nbsp;';
	section.innerHTML += '<span title="Brightness"><input type="number" id="_inpGSVBrightness" max=200 min=0 step=25 style="height:20px; width:47px;text-align:right;"/><b>%</b><span class="fa fa-sun-o"></span></span>&nbsp;&nbsp;&nbsp;';
	section.innerHTML += '<span title="Invert colours"><input type="checkbox" id="_cbGSVInvert"/><span class="fa fa-tint"></span></span>';
	section.innerHTML += '<br>';
	section.innerHTML += '<br>';
	section.innerHTML += '<b>UI Enhancements</b><br>';
	section.innerHTML += '<input type="checkbox" id="_cbShrinkTopBars" /> ' +
			'<span title="Because we can\'t afford to waste screen space, particularly on\nstuff we didn\'t ask for and don\'t want, like the black bar.\nAnd why does the reload button have a re-do icon?!">Compress/enhance bars above the map</span><br>';
	section.innerHTML += '<input type="checkbox" id="_cbCompressSegmentTab" /> ' +
			'<span title="Because I\'m sick of having to scroll the side panel because of oversized fonts and wasted space">Compress/enhance side panel contents</span><br>';
	section.innerHTML += '<input type="checkbox" id="_cbCompressLayersMenu" /> ' +
			'<span title="Because it\'s already too big for small screens and Waze only plan to make it bigger">Compress/enhance layers menu</span><br>';
	section.innerHTML += '<span id="layersColControls"><input type="checkbox" id="_cbLayersColumns" /> ' +
			'<span title="Widen the layers menu to 2 columns - particulary for netbook users\nWon\'t work without some compression turned on">Two-column layers menu</span><br></span>';
	section.innerHTML += '<input type="checkbox" id="_cbRestyleReports" /> ' +
			'<span title="Another UI element configured for developers with massive screens instead of normal users">Compress/enhance report panels (UR/MP)</span><br>';
	section.innerHTML += '<input type="checkbox" id="_cbEnhanceChat" /> ' +
			'<span title="A perfect example of the new WME UI. Looks very stylish,\nbut destroys usability and utterly ignores small-screen users.">Compress/enhance Chat panel</span><br>';
	section.innerHTML += '<input type="checkbox" id="_cbNarrowSidePanel" /> ' +
			'<span title="If you have a netbook, Waze isn\'t interested in your experience.\nYou need every bit of map space you can get - so have a present from me!">Reduce width of the side panel</span><span title="This will definitely interfere with scripts that rely on a fixed width for their tab contents." style="font-size: 16px; color: red;">&#9888</span><br>';
	section.innerHTML += '<br>';
	section.innerHTML += '<b title="Control the amount of compression/enhancment">UI Enhancement controls<br>';
	section.innerHTML += '<div style="display:inline-block"><select id="_inpUICompression" title="Compression enhancement" style="height:20px; padding:0px; border-radius=0px;"><option value="2">High</option><option value="1">Low</option><option value="0">None</option></select><span class="fa fa-compress"></span></div>&nbsp;&nbsp;&nbsp;&nbsp;';
	section.innerHTML += '<div style="display:inline-block"><select id="_inpUIContrast" title="Contrast enhancement" style="height:20px; padding:0px; border-radius=0px;"><option value="2">High</option><option value="1">Low</option><option value="0">None</option></select><span class="fa fa-adjust"></span></div>';
	section.innerHTML += '<br>';
	section.innerHTML += '<button id="_btnKillNode" style = "height: 18px; margin-top: 5px;" title="Hide the junction nodes layer to allow access to Map Comments hidden under nodes.\nThis stays in effect until the page is zoomed/panned/refreshed.">Hide junction nodes</button> <span style = "color: red; font-weight: bold;">--- NEW</span></br>';
	section.innerHTML += '<br>';
	section.innerHTML += '<b>UI Fixes/changes</b><br>';
	section.innerHTML += '<input type="checkbox" id="_cbMoveZoomBar" /> ' +
			'<span title="Because nobody likes a pointless UI change that breaks your workflow,\nimposed by idiots who rarely use the editor and don\'t listen to feedback.\nNO MATTER HOW HARD THEY TRY, I WILL BRING IT BACK!">Create zoom bar & move map controls <span style = "color: red; font-weight: bold;">--- NEW (& old!)</span></span><br>';
	section.innerHTML += '<input type="checkbox" id="_cbHideUserInfo" /> ' +
			'<span title="Because we can earn points quicker without a massive chunk of space\nwasted on telling us how many we earnt up to yesterday">Hide user info in the side panel</span><br>';
	section.innerHTML += '<input type="checkbox" id="_cbFixExternalProviders" /> ' +
			'<span title="The External Providers interface has a dexcription box that will only show one live of text.\nThis fixes that.">Expand External Provider details for places</span><br>';
	section.innerHTML += '<input type="checkbox" id="_cbPermalinkChecker" /> ' +
			'<span title="If a permalink is created with off-screen segments or segment IDs have been changed,\nWME may open with fewer segments selected than are included in the permalink.\nThis causes a pop-up warning when that happens.">Warn on invalid permalinks</span><br>';
	section.innerHTML += '<input type="checkbox" id="_cbMoveChatIcon" /> ' +
			'<span title="Here\'s a truly outstanding example of making a stupid change to the UI in order to\ndeal with another stupid change to the UI!\nBecause HQ couldn\'t make the new layers menu auto-hide, they moved the chat icon.\nTick this box to put it back where it belongs.">Move Chat icon back to right</span><br>';
	section.innerHTML += '<input type="checkbox" id="_cbHighlightInvisible" /> ' +
			'<span title="Typical WME design - the chat icon changes when you\'re invisible,\nbut the change is practically invisible!\nThis option provides a more obvious highlight.">Highlight invisible mode</span></span><br>';
	section.innerHTML += '<input type="checkbox" id="_cbLayersMenuMoreOptions" /> ' +
			'<span title="As requested by users, this option turns on the More Options in the Layers menu.\nNote that this option only has an effect when the page is loaded. You can still toggle as normal.">Turn on More Options in Layers menu</span><br>';
	section.innerHTML += '<input type="checkbox" id="_cbDarkenSaveLayer" /> ' +
			'<span title="It\'s not bad enough they\'ve removed all the contrast to give you eyestrain,\nbut then they blind you every time you save. ">Darken screen overlay when saving</span><br>';
	section.innerHTML += '<input type="checkbox" id="_cbSwapRoadsGPS" /> ' +
			'<span title="Guess what? Waze thinks the GPS layer should now be over the segments layer.\nWhy should you have any choice about that?">Move GPS layer below segments layer</span><br>';
	section.innerHTML += '<input type="checkbox" id="_cbUndarkenAerials" /> ' +
			'<span title="A new contribution from WME V2 to your eyestrain. Sometimes the aerial images\nare too dark - so WME makes them darker! This kills that behaviour.">Un-darken aerial images</span><br>';
	section.innerHTML += '<input type="checkbox" id="_cbShowMapBlockers" /> ' +
			'<span title="Some WME elements block access to the map layers. These problems have been reported as bugs.\nUntil they\'re fixed, this functions makes them visible.">Show map-blocking WME bugs</span></span><br>';
	section.innerHTML += '<input type="checkbox" id="_cbHideLinks" /> ' +
			'<span title="Hide the small Links bar at the bottom of the side panel,\nto give more usable space there.">Hide Links panel</span><br>';
	section.innerHTML += '<input type="checkbox" id="_cbFixBridgeButton" />Fix ' +
			'<input type="checkbox" id="_cbDisableBridgeButton" />' +
			'<span title="The Bridge button is rarely useful, but often used incorrectly. It also ovelaps\nthe junction node, so it\'s often clicked by accident.\nFixing it moves it off the junction node. Disabling it makes even more sense.">Disable Bridge button</span><br>';
	section.innerHTML += '<input type="checkbox" id="_cbMondayFirst" /> ' +
			'<span title="Requests to have calendar items localised with Monday as the first day of the week\ngo back a while. Now you don\'t have to wait for Waze.">Start calendars on Monday</span><br>';
	section.innerHTML += '<input type="checkbox" id="_cbISODates" /> ' +
			'<span title="Dates in the Restrictions dialogues are all in American format - MM/DD/YY\nFine if you\' American, confusing as hell for the rest of us!\nThis changes the dates to ISO format, matching the Closures dialogue">ISO dates in Restrictions</span><br>';
	section.innerHTML += '<input type="checkbox" id="_cbDisableKinetic" /> ' +
			'<span title="Kinetic panning is a new WME feature: if you release the mouse whilst dragging the map,\nthe map will keep moving. It can be very useful for panning large distances.\nIt can also be very annoying. Now YOU have control.">Disable Kinetic Panning <span style = "color: red; font-weight: bold;">--- NEW</span></span><br>';
	section.innerHTML += '<input type="checkbox" id="_cbDisableScrollZoom" /> ' +
			'<span title="Zooming with the scroll wheel can be problematic when using an Apple Magic Mouse, which\nscrolls on touch. This will disable scroll-to-zoom.">Disable scroll-to-zoom <span style = "color: red; font-weight: bold;">--- NEW</span></span><br>';
	section.innerHTML += '<br>';
	section.innerHTML += '<b><a href="https://www.waze.com/forum/viewtopic.php?f=819&t=191178" title="Forum topic" target="_blank"><u>' +
			'WME Fix UI</u></a></b> &nbsp; v' + wmefu_version;
	addon.appendChild(section);
	addon.className = "tab-pane";
	return addon;
}

function addMyTab(model,modeID) {
	if (modeID === 0) {
		logit("entering default mode, so creating tab");
		tabAttempts = 0;
		tabsLooper();
	} else {
		logit("entering event mode, so not initialising");
		return;
	}
}

function tabsLooper() {
	tabAttempts += 1;
	if (tabAttempts > 20) {
		// tried 20 times to create tab without luck
		logit("unable to create my tab after 20 attempts","error");
		return;
	}
	var userTabs = getId('user-info');
	var navTabs = getElementsByClassName('nav-tabs', userTabs)[0];
	if (typeof navTabs === "undefined") {
		//the basic tabs aren't there yet, so I can't add mine
		logit("waiting for NavTabs","warning");
		setTimeout(tabsLooper, 200);
	} else{
		var tabContent = getElementsByClassName('tab-content', userTabs)[0];
		newtab = document.createElement('li');
		newtab.innerHTML = '<a href="#sidepanel-FixUI" data-toggle="tab" title="Fix UI">FU</a>';
		navTabs.appendChild(newtab);
		tabContent.appendChild(wmeFUAddon);
		if (_cbShrinkTopBars.checked === true) {
			hackToolbarButtons();
		}
	}
}

function loadSettings() {
	var fname = arguments.callee.toString().match(/function ([^\(]+)/)[1];
	logit("function " + fname + " called", "debug");
	// Convert old version of settings to new version
	var options;
	if (localStorage.WMEFixUI) {
		var oldSettings = JSON.parse(localStorage.WMEFixUI);
		var newSettings = {};
		newSettings.oldVersion = (oldSettings[0] ? oldSettings[0] : "1.0" );
		newSettings.moveZoomBar = (oldSettings[1] ? oldSettings[1] : true );
		newSettings.shrinkTopBars = (oldSettings[2] ? oldSettings[2] : true );
		newSettings.hideUserInfo = (oldSettings[3] ? oldSettings[3] : true );
		newSettings.restyleSidePanel = (oldSettings[4] ? oldSettings[4] : true );
		newSettings.restyleReports = (oldSettings[5] ? oldSettings[5] : true );
		newSettings.narrowSidePanel = (oldSettings[7] ? oldSettings[7] : false );
		newSettings.aerialShiftX = (oldSettings[10] ? oldSettings[10] : 0 );
		newSettings.aerialShiftY = (oldSettings[11] ? oldSettings[11] : 0 );
		newSettings.aerialOpacity = (oldSettings[12] ? oldSettings[12] : 100 );
		newSettings.fixExternalProviders = (oldSettings[13] ? oldSettings[13] : true );
		newSettings.GSVContrast = (oldSettings[14] ? oldSettings[14] : 100 );
		newSettings.GSVBrightness = (oldSettings[15] ? oldSettings[15] : 100 );
		newSettings.GSVInvert = (oldSettings[16] ? oldSettings[16] : false );
		newSettings.permalinkChecker = (oldSettings[18] ? oldSettings[18] : true );
		newSettings.restyleLayersMenu = (oldSettings[19] ? oldSettings[19] : true );
		newSettings.moveChatIcon = (oldSettings[20] ? oldSettings[20] : true );
		// setting[21] was Menu Autohide - no longer needed
		newSettings.layersMenuMore = (oldSettings[22] ? oldSettings[22] : true );
		localStorage.WMEFUSettings = JSON.stringify(newSettings);
		localStorage.removeItem("WMEFixUI");
	}

	if (localStorage.WMEFUSettings) {
		options = JSON.parse(localStorage.WMEFUSettings);
	} else {
		options = {};
	}
	oldVersion = (options.oldVersion !== undefined ? options.oldVersion : "0.0");
	getId('_cbMoveZoomBar').checked = (options.moveZoomBar !== undefined ? options.moveZoomBar : true);
	getId('_cbShrinkTopBars').checked = (options.shrinkTopBars !== undefined ? options.shrinkTopBars : true);
	getId('_cbHideUserInfo').checked = ( options.hideUserInfo !== undefined ? options.hideUserInfo : true);
	getId('_cbCompressSegmentTab').checked = ( options.restyleSidePanel !== undefined ? options.restyleSidePanel : true);
	getId('_cbRestyleReports').checked = ( options.restyleReports !== undefined ? options.restyleReports : true);
	getId('_cbEnhanceChat').checked = ( options.enhanceChat !== undefined ? options.enhanceChat : true);
	getId('_cbNarrowSidePanel').checked = ( options.narrowSidePanel !== undefined ? options.narrowSidePanel : false);
	getId('_inpASX').value = ( options.aerialShiftX !== undefined ? options.aerialShiftX : 0);
	getId('_inpASY').value = ( options.aerialShiftY !== undefined ? options.aerialShiftY : 0);
	getId('_inpASO').value = ( options.aerialOpacity !== undefined ? options.aerialOpacity : 100);
	getId('_cbFixExternalProviders').checked = ( options.fixExternalProviders !== undefined ? options.fixExternalProviders : true);
	getId('_inpGSVContrast').value = ( options.GSVContrast !== undefined ? options.GSVContrast : 100);
	getId('_inpGSVBrightness').value = ( options.GSVBrightness !== undefined ? options.GSVBrightness : 100);
	getId('_cbGSVInvert').checked = ( options.GSVInvert !== undefined ? options.GSVInvert : false);
	getId('_cbPermalinkChecker').checked = ( options.permalinkChecker !== undefined ? options.permalinkChecker : true);
	getId('_cbCompressLayersMenu').checked = ( options.restyleLayersMenu !== undefined ? options.restyleLayersMenu : true);
	getId('_cbLayersColumns').checked = ( options.layers2Cols !== undefined ? options.layers2Cols : false);
	getId('_cbMoveChatIcon').checked = ( options.moveChatIcon !== undefined ? options.moveChatIcon : true);
	getId('_cbHighlightInvisible').checked = ( options.highlightInvisible !== undefined ? options.highlightInvisible : true);
	getId('_cbDarkenSaveLayer').checked = ( options.darkenSaveLayer !== undefined ? options.darkenSaveLayer : true);
	getId('_cbLayersMenuMoreOptions').checked = ( options.layersMenuMore !== undefined ? options.layersMenuMore : true);
	getId('_inpUIContrast').value = ( options.UIContrast !== undefined ? options.UIContrast : 1);
	getId('_inpUICompression').value = ( options.UICompression !== undefined ? options.UICompression : 1);
	getId('_cbSwapRoadsGPS').checked = ( options.swapRoadsGPS !== undefined ? options.swapRoadsGPS : true);
	getId('_cbUndarkenAerials').checked = ( options.undarkenAerials !== undefined ? options.undarkenAerials : true);
	getId('_cbShowMapBlockers').checked = ( options.showMapBlockers !== undefined ? options.showMapBlockers : true);
	getId('_cbHideLinks').checked = ( options.hideLinks !== undefined ? options.hideLinks : false);
	getId('_cbFixBridgeButton').checked = ( options.fixBridgeButton !== undefined ? options.fixBridgeButton : true);
	getId('_cbDisableBridgeButton').checked = ( options.disableBridgeButton !== undefined ? options.disableBridgeButton : true);
	getId('_cbISODates').checked = ( options.ISODates !== undefined ? options.ISODates : true);
	getId('_cbMondayFirst').checked = ( options.mondayFirst !== undefined ? options.mondayFirst : false);
	getId('_cbDisableKinetic').checked = ( options.disableKinetic !== undefined ? options.disableKinetic : false);
	getId('_cbDisableScrollZoom').checked = ( options.disableScrollZoom !== undefined ? options.disableScrollZoom : false);
}

function saveSettings() {
	var fname = arguments.callee.toString().match(/function ([^\(]+)/)[1];
	logit("function " + fname + " called", "debug");
	if (localStorage) {
		logit("saving options to local storage");
		var options = {};
		options.oldVersion = wmefu_version;
		options.moveZoomBar = getId('_cbMoveZoomBar').checked;
		options.shrinkTopBars = getId('_cbShrinkTopBars').checked;
		options.hideUserInfo = getId('_cbHideUserInfo').checked;
		options.restyleSidePanel = getId('_cbCompressSegmentTab').checked;
		options.restyleReports = getId('_cbRestyleReports').checked;
		options.enhanceChat = getId('_cbEnhanceChat').checked;
		options.narrowSidePanel = getId('_cbNarrowSidePanel').checked;
		options.aerialShiftX = getId('_inpASX').value;
		options.aerialShiftY = getId('_inpASY').value;
		options.aerialOpacity = getId('_inpASO').value;
		options.fixExternalProviders = getId('_cbFixExternalProviders').checked;
		options.GSVContrast = getId('_inpGSVContrast').value;
		options.GSVBrightness = getId('_inpGSVBrightness').value;
		options.GSVInvert = getId('_cbGSVInvert').checked;
		options.permalinkChecker = getId('_cbPermalinkChecker').checked;
		options.restyleLayersMenu = getId('_cbCompressLayersMenu').checked;
		options.layers2Cols = getId('_cbLayersColumns').checked;
		options.moveChatIcon = getId('_cbMoveChatIcon').checked;
		options.highlightInvisible = getId('_cbHighlightInvisible').checked;
		options.darkenSaveLayer = getId('_cbDarkenSaveLayer').checked;
		options.layersMenuMore = getId('_cbLayersMenuMoreOptions').checked;
		options.UIContrast = getId('_inpUIContrast').value;
		options.UICompression = getId('_inpUICompression').value;
		options.swapRoadsGPS = getId('_cbSwapRoadsGPS').checked;
		options.undarkenAerials = getId('_cbUndarkenAerials').checked;
		options.showMapBlockers = getId('_cbShowMapBlockers').checked;
		options.hideLinks = getId('_cbHideLinks').checked;
		options.fixBridgeButton = getId('_cbFixBridgeButton').checked;
		options.disableBridgeButton = getId('_cbDisableBridgeButton').checked;
		options.ISODates = getId('_cbISODates').checked;
		options.mondayFirst = getId('_cbMondayFirst').checked;
		options.disableKinetic = getId('_cbDisableKinetic').checked;
		options.disableScrollZoom = getId('_cbDisableScrollZoom').checked;
		localStorage.WMEFUSettings = JSON.stringify(options);
	}
}

function applyAllSettings() {
	var fname = arguments.callee.toString().match(/function ([^\(]+)/)[1];
	logit("function " + fname + " called", "debug");
	console.group(prefix + ": applying all settings");
		kineticDragParams = W.map.controls.find(control => control.dragPan).dragPan.kinetic;
		shrinkTopBars();
		hideUserInfo();
		compressSegmentTab();
		restyleReports();
		enhanceChat();
		narrowSidePanel();
		fixExternalProviders();
		warnCommentsOff();
		adjustGSV();
		compressLayersMenu();
		moveChatIcon();
		highlightInvisible();
		darkenSaveLayer();
		swapRoadsGPS();
		undarkenAerials();
		showMapBlockers();
		hideLinks();
		fixBridgeButton();
		disableBridgeButton();
		disableKinetic();
		disableScrollZoom();
		createZoomBar();
	console.groupEnd();
	RestrictionObserver.observe(getId('dialog-container'), { childList: true, subtree: true });
	ClosureObserver.observe(getId('edit-panel'), { childList: true, subtree: true });
	if (getId('_cbLayersMenuMoreOptions').checked === true) {
		$("#toolbar > div > div.layer-switcher-container > div > div > div > div > div.menu > div.more-options-toggle > label > div").click();
	}
	wmeFUinitialising = false;
	saveSettings();
}

function applyEnhancements() {
	var fname = arguments.callee.toString().match(/function ([^\(]+)/)[1];
	logit("function " + fname + " called", "debug");
	shrinkTopBars();
	compressSegmentTab();
	restyleReports();
	enhanceChat();
	compressLayersMenu();
}

function createZoomBar() {
	var fname = arguments.callee.toString().match(/function ([^\(]+)/)[1];
	logit("function " + fname + " called", "debug");
	if (_cbMoveZoomBar.checked) {
		yslider = new OL.Control.PanZoomBar({zoomStopHeight:9 , panIcons:false});
		yslider.position.x = 10;
		yslider.position.y = 35;
		W.map.addControl(yslider);
		var styles = "";
		//Overall bar
		styles += '.olControlPanZoomBar { left: 10px; top: 35px; height: 158px; border: 1px solid #f0f2f2; background-color: #f0f2f2; border-radius: 30px; width: 24px; box-sizing: initial; }';
		//zoom in/out buttons
		styles += '.olButton { background-color: white; border-radius: 30px; width: 24px; height: 24px; cursor: pointer; }';
		styles += '.olControlZoomButton { padding: 3px 5px; font-size: 18px; }';
		//slider stops
		styles += '.yslider-stops { width: 24px; height: 110px; background-color: #f3f3f3; background-image: linear-gradient(90deg, transparent 45%, #dedede 45%, #dedede 55%, transparent 55%), linear-gradient(#dedede 1px, transparent 1px); background-size: 50% 8px; background-repeat: repeat-y; background-position: 6px; }';
		//slider
		styles += '.slider { position: absolute; font-size: 15px; font-weight: 900; line-height: 1; text-align: center; width: 24px; height: 18px; margin-top: -29px; padding-top: 1px; border: 1px solid lightgrey; border-radius: 10px; background-color: white; cursor: ns-resize; }';
		//Move other WME controls and kill new zoom buttons
		styles += '#overlay-buttons { right: inherit !important; bottom: inherit; top: 204px; left: 9px; }';
		styles += '.zoom-bar-region { display: none; }';
		styles += '.street-view-mode #overlay-buttons { right: inherit; margin-right: inherit; }';
		// keep a space for the GSV control whilst GSV is active
		styles += '.street-view-region { height: 29px; }';
		// fix for WME BeenHere - old but I still use it :)
		styles += '#BeenHere { top: 310px !important; }';
		// shift UR/MP panel to the right
		styles += '#panel-container > div { left: 40px; }';
		// fix for WME Map Tiles Update
		styles += '#Info_div { margin-bottom: 0px !important; }';
		addStyle(prefix + fname,styles);
		W.map.events.register("zoomend", null, ZLI);
		ZLI();
	} else {
		if (yslider) {
			yslider.destroy();
		}
		W.map.events.unregister("zoomend", null, ZLI);
		removeStyle(prefix + fname);
		removeStyle('WMEMTU');
	}	
}

function ZLI() {
	if (yslider) {
		//Need to reset the OpenLayers-created settings from the zoom bar when it's redrawn
		//Overall bar
		yslider.div.style.left = "";
		yslider.div.style.top = "";
		//zoom in/out buttons
		yslider.buttons[0].style = "";
		yslider.buttons[0].innerHTML = "<div class='olControlZoomButton fa fa-plus' ></div>";
		yslider.buttons[1].style = "";
		yslider.buttons[1].innerHTML = "<div class='olControlZoomButton fa fa-minus' ></div>";
		//slider stops
		yslider.zoombarDiv.classList.add("yslider-stops");
		yslider.zoombarDiv.classList.remove("olButton");
		yslider.zoombarDiv.style="";
		//slider
		yslider.slider.innerHTML = "";
		yslider.slider.style = "";
		yslider.slider.classList.add("slider");
		yslider.moveZoomBar();
		//Actually set the ZLI
		yslider.slider.innerText = W.map.zoom;
		yslider.slider.title = "Zoom level indicator by WMEFU";
		switch (W.map.zoom) {
			case 0:
			case 1:
				yslider.slider.style.background = '#ef9a9a';
				yslider.slider.title += "\nCannot permalink any segments at this zoom level";
				break;
			case 2:
			case 3:
				yslider.slider.style.background = '#ffe082';
				yslider.slider.title += "\nCan only permalink primary or higher at this zoom level";
				break;
			default:
				yslider.slider.style.background = '#ffffff';
				yslider.slider.title += "\nCan permalink any segments at this zoom level";
				break;
		}
		// change document location of WME Map Update Info_div
		if (getId("Info_div")) {
			getId("overlay-buttons").appendChild(getId("Info_div"));
			getId("Info_div").style.marginTop = "10px";
			getId("Info_div").style.marginLeft = "4px";
		}
	}
}

function hideUserInfo() {
	// Now functioning correctly for prod & beta
	var fname = arguments.callee.toString().match(/function ([^\(]+)/)[1];
	logit("function " + fname + " called", "debug");
	var styles = "";
	// WME Panel Swap buttons - move them up if user info is hidden
	var PSButton1 = getId('WMEPS_UIButton');
	var PSButton2 = getId('WMEPS_EditButton');
	if (_cbHideUserInfo.checked) {
		styles += '#user-box { display: none; }';
		// extra fix for WME Panel Swap control (not working with new WME UI)
		if (PSButton1) { PSButton1.style.top = '-27px'; }
		if (PSButton2) { PSButton2.style.top = '-27px'; }
		addStyle(prefix + fname,styles);
		//Fix to move control button of Invalidated Camera Mass Eraser
		if (getId("_UCME_btn")) {
			var but = getId("_UCME_btn");
			var dest = getId("advanced-tools");
			getId("advanced-tools").appendChild(getId("_UCME_btn"));
			document.getElementById('UCME_btn').parentNode.removeChild(document.getElementById('UCME_btn'));
		}
	} else {
		if (PSButton1) { PSButton1.style.top = '-27px'; }
		if (PSButton2) { PSButton2.style.top = '-27px'; }
		removeStyle(prefix + fname);
	}
}

function shrinkTopBars() {
	var fname = arguments.callee.toString().match(/function ([^\(]+)/)[1];
	logit("function " + fname + " called", "debug");
	var styles = "";
	if (_cbShrinkTopBars.checked) {
		//always do this stuff
		//event mode button
		styles += '#mode-switcher .title-button .icon { font-size: 13px; font-weight: bold; color: black; }';
		//black bar
		styles += '#topbar-container { pointer-events: none; }';
		styles += '#map #topbar-container .topbar > div { pointer-events: initial; }';
		//change toolbar buttons - from JustinS83
		$('#mode-switcher .title-button .icon').removeClass('fa fa-angle-down');
		$('#mode-switcher .title-button .icon').addClass('fa fa-calendar');
		hackToolbarButtons();
		// HN editing tweaks
		styles += '#map-lightbox .content { pointer-events: none; }';
		styles += '#map-lightbox .content > div { pointer-events: initial; }';
		styles += '#map-lightbox .content .header { pointer-events: none !important; }';
		styles += '.toolbar .toolbar-button.add-house-number { background-color: #61cbff; float: right; font-weight: bold; }';
		styles += '.waze-icon-exit { background-color: #61cbff; font-weight: bold; }';
		// event mode button
		styles += '.toolbar.toolbar-mte .add-button { background-color: orange; font-weight: bold; }';
		var contrast = _inpUIContrast.value;
		var compress = _inpUICompression.value;
		if (compress > 0) {
			styles += '#app-head { height: ' + ['','35px','24px'][compress] + '; }';
			styles += '#app-head aside #brand { height: ' + ['','34px','22px'][compress] + '; padding-left: ' + ['','10px','5px'][compress] + '; }';
			styles += '.toolbar { height: ' + ['','35px','24px'][compress] + '; }';
			styles += '#mode-switcher .title-button .icon { line-height: ' + ['','34px','22px'][compress] + '; }';
			//search box
			styles += '#search { padding-top: ' + ['','3px','0px'][compress] + '; }';
			styles += '.form-search { height: ' + ['','27px','20px'][compress] + '; }';
			styles += '.form-search .search-query { height: ' + ['','26px','19px'][compress] + '; font-size: ' + ['','13px','12px'][compress] + '; }';
			styles += '.form-search .input-wrapper::after { top: ' + ['','6px','2px'][compress] + '; }';
			//toolbar dropdown menus
			//Toolbox switcher
			styles += '#toolbox-switcher .toolbar-button { margin-top: 0px; line-height: ' + ['','34px','22px'][compress] + '; }';
			styles += '#toolbox-switcher .fa { margin-right: ' + ['','5px','0px'][compress] + ' !important; }';
			//Toolbox menu
			styles += '.toolbox-dropdown-menu { top: ' + ['','17px','12px'][compress] + ' !important; }';
			//toolbar dropdowns
			styles += '.toolbar .toolbar-group { margin-right: ' + ['','14px','8px'][compress] + '; }';
			styles += '.toolbar .toolbar-icon { width: ' + ['','31px','22px'][compress] + '; height: ' + ['','34px','22px'][compress] + '; line-height: ' + ['','34px','22px'][compress] + '; }';
			styles += '.toolbar .group-title { height: ' + ['','34px','22px'][compress] + '; line-height: ' + ['','34px','22px'][compress] + '; margin-left: ' + ['','31px','22px'][compress] + '; }';
			styles += '.toolbar .dropdown-menu { top: ' + ['','34px','22px'][compress] + ' !important; left: ' + ['','7px','4px'][compress] + ' !important; }';
			//toolbar buttons
			styles += '#edit-buttons > div > .toolbar-button { margin-top: ' + ['','3px','1px'][compress] + '; margin-left: 3px; padding-left: ' + ['','10px','5px'][compress] + '; padding-right: ' + ['','10px','5px'][compress] + '; height: ' + ['','27px','22px'][compress] + '; line-height: ' + ['','27px','22px'][compress] + '; }';
			//keep save button wide enough for counter
			styles += '.toolbar .toolbar-button.waze-icon-save { padding-right: 15px !important; }';
			styles += '.toolbar .toolbar-button.waze-icon-save .counter { top: ' + ['','-3px','-1px'][compress] + '; }';
			styles += '#edit-buttons > div > .toolbar-button > .item-icon { top: ' + ['','5px','2px'][compress] + '; }';
			styles += '.toolbar .toolbar-separator { height: ' + ['','34px','22px'][compress] + '; }';
			//layers menu
			styles += '.waze-icon-layers { height: ' + ['','27px','22px'][compress] + ' !important; margin-top: ' + ['','3px','0px'][compress] + ' !important; }';
			styles += '.layer-switcher .menu { top: ' + ['','31px','24px'][compress] + '; }';
			//new save menu
			styles += '.changes-log-region { top: ' + ['','26px','21px'][compress] + '; }';
			// fix for WME Edit Count Monitor
			styles += '#edit-buttons > div > div:nth-child(10) { margin-top: ' + ['','5px','-1px'][compress] + ' !important; }';
			//black bar
			styles += '.topbar { height: ' + ['','24px','18px'][compress] + '; line-height: ' + ['','24px','18px'][compress] + '; }';
		}
		if (contrast > 0) {
			//toolbar dropdown menus
			styles += '.toolbar .group-title { color: black; }';
			styles += '#edit-buttons > div > .toolbar-button { border-radius: 8px; border: 1px solid ' + ['','lightgrey','grey'][contrast] + '; color: black; }';
			//layers icon - until Waze fix it
			styles += '.layer-switcher .waze-icon-layers.toolbar-button{ background-color: white; }';
		}
//		//fix for buttons of WME GIS script
//		styles += '.btn-group-sm { text-shadow: initial; background: white; }';
		addStyle(prefix + fname,styles);
	} else {
		removeStyle(prefix + fname);
		//change toolbar buttons - from JustinS83
		$('#mode-switcher .title-button .icon').removeClass('fa fa-calendar');
		$('#mode-switcher .title-button .icon').addClass('fa fa-angle-down');
		//un-hack Toolbar buttons
		if (document.getElementsByClassName("waze-icon-reload").length > 0) {
			$('.waze-icon-reload span').removeClass('fa fa-refresh fa-lg');
			$('.waze-icon-reload').addClass('reload');
			$('.waze-icon-reload span')[0].innerHTML = "Reload";
		}
		if (document.getElementsByClassName("waze-icon-undo").length > 0) {
			$('.waze-icon-undo span').removeClass('fa fa-undo fa-lg');
			$('.waze-icon-undo').addClass('undo');
			$('.waze-icon-undo span')[0].innerHTML = "Undo";
		}
		if (document.getElementsByClassName("waze-icon-redo").length > 0) {
			$('.waze-icon-redo span').removeClass('fa fa-repeat fa-lg');
			$('.waze-icon-redo').addClass('redo');
			$('.waze-icon-redo span')[0].innerHTML = "Redo";
		}
		buttonObserver.disconnect();
	}
	window.dispatchEvent(new Event('resize'));
}

function hackToolbarButtons() {
	if (document.getElementsByClassName("waze-icon-reload").length > 0) {
		$('.waze-icon-reload').removeClass('reload');
		$('.waze-icon-reload span').addClass('fa fa-refresh fa-lg');
		$('.waze-icon-reload span')[0].innerHTML = "";
	}
	if (document.getElementsByClassName("waze-icon-undo").length > 0) {
		$('.waze-icon-undo').removeClass('undo');
		$('.waze-icon-undo span').addClass('fa fa-undo fa-lg');
		$('.waze-icon-undo span')[0].innerHTML = "";
	}
	if (document.getElementsByClassName("waze-icon-redo").length > 0) {
		$('.waze-icon-redo').removeClass('redo');
		$('.waze-icon-redo span').addClass('fa fa-repeat fa-lg');
		$('.waze-icon-redo span')[0].innerHTML = "";
	}
	buttonObserver.observe(getId('edit-buttons'), { childList: true, subtree: true });
}

function FALSEcompressSegmentTab() {
	_cbCompressSegmentTab.checked = _cbextraCBSection.checked;
	compressSegmentTab();
}

function compressSegmentTab() {
	var fname = arguments.callee.toString().match(/function ([^\(]+)/)[1];
	logit("function " + fname + " called", "debug");
	var styles = "";
	if (_cbCompressSegmentTab.checked) {
		var contrast = _inpUIContrast.value;
		var compress = _inpUICompression.value;
		//Neuter the top gradient
		styles += '#sidebar .tab-scroll-gradient { pointer-events: none; }';
		//Nuke the bottom gradient
		styles += '#sidebar #links:before { display: none; }';
		// Make map comment text always visible
		styles += '.map-comment-name-editor .edit-button { display: block !important; }';
		if (compress > 0) {
			//general compression enhancements
			styles += '#sidebar #advanced-tools { padding: ' + ['','0 9px','0 4px'][compress] + '; }';
			styles += '#sidebar .waze-staff-tools { margin-bottom: ' + ['','9px','4px'][compress] + '; height: ' + ['','25px','20px'][compress] + '; }';
			styles += '#sidebar .tab-content { padding: ' + ['','9px','4px'][compress] + '; padding-top: ' + ['','4px','0px'][compress] + '; }';
			//Tabs
			styles += '#sidebar .nav-tabs { padding-bottom: ' + ['','3px','2px'][compress] + '; }';
			styles += '#sidebar #user-info #user-tabs { padding: ' + ['','0 9px','0 4px'][compress] + '; }';
			styles += '#sidebar .nav-tabs li a { margin-top: ' + ['','2px','1px'][compress] + '; margin-left: ' + ['','3px','1px'][compress] + '; padding-top: 0px !important; line-height: ' + ['','24px','21px'][compress] + '; height: ' + ['','24px','21px'][compress] + '; }';
			styles += '#sidebar .nav-tabs li { flex-grow: 0; }';
			//Feed
			styles += '.feed-item { margin-bottom: ' + ['','3px','1px'][compress] + '; }';
			styles += '.feed-item .inner { padding: ' + ['','5px','0px'][compress] + '; }';
			styles += '.feed-item .content .title { margin-bottom: ' + ['','1px','0px'][compress] + '; }';
			styles += '.feed-item .motivation { margin-bottom: ' + ['','2px','0px'][compress] + '; }';
			//Drives & Areas
			styles += '#sidebar .message { margin-bottom: ' + ['','6px','2px'][compress] + '; }';
			styles += '#sidebar .result-list .result { padding: ' + ['','6px 17px','2px 9px'][compress] + '; margin-bottom: ' + ['','3px','1px'][compress] + '; }';
			styles += '#sidebar .result-list .session { background-color: lightgrey; }';
			styles += '#sidebar .result-list .session-available { background-color: white; }';
			styles += '#sidebar .result-list .result.selected { background-color: lightgreen; }';
			styles += 'div#sidepanel-drives { height: auto !important; }';
			//SEGMENT EDIT PANEL
			//general changes
			//checkbox groups
			styles += '#sidebar .controls-container { padding-top: ' + ['','4px','1px'][compress] + '; display: inline-block; font-size: ' + ['','12px','11px'][compress] + '; }';
			styles += '.controls-container input[type="checkbox"] + label { padding-left: ' + ['','21px','17px'][compress] + ' !important; } }';
			//form groups
			styles += '#sidebar .form-group { margin-bottom: ' + ['','5px','0px'][compress] + '; }';
			//dropdown inputs
			styles += '#sidebar .form-control { height: ' + ['','27px','19px'][compress] + '; padding-top: ' + ['','4px','0px'][compress] + '; padding-bottom: ' + ['','4px','0px'][compress] + '; font-size: ' + ['','13px','12px'][compress] + '; color: black; }';
			//buttons
			styles += '#edit-panel .waze-btn { padding-top: 0px !important; padding-bottom: ' + ['','3px','1px'][compress] + '; height: ' + ['','20px','18px'][compress] + ' !important; line-height: ' + ['','20px','18px'][compress] + ' !important; font-size: ' + ['','13px','12px'][compress] + '; }';
//			styles += '#edit-panel .waze-btn { padding-top: ' + ['','3px','0px'][compress] + ' !important; padding-bottom: ' + ['','3px','1px'][compress] + '; height: ' + ['','20px','18px'][compress] + ' !important; line-height: ' + ['','20px','18px'][compress] + ' !important; font-size: ' + ['','13px','12px'][compress] + '; }';
			//radio button controls
			styles += '.waze-radio-container label { height: ' + ['','19px','16px'][compress] + '; width: ' + ['','19px','16px'][compress] + '; line-height: ' + ['','19px','16px'][compress] + '; font-size: ' + ['','13px','12px'][compress] + '; margin-bottom: ' + ['','3px','1px'][compress] + '; }';
			styles += '.waze-radio-container label { width: auto; padding-left: ' + ['','6px','3px'][compress] + ' !important; padding-right: ' + ['','6px','3px'][compress] + ' !important; }';
			//text input areas
			styles += '#sidebar textarea.form-control { height: auto; }';
			styles += '#sidebar textarea { max-width: unset; }';
			//specific changes
			//Selected segments info
			styles += '#edit-panel .selection { padding-top: ' + ['','8px','2px'][compress] + '; padding-bottom: ' + ['','8px','4px'][compress] + '; }';
			styles += '#edit-panel .segment .direction-message { margin-bottom: ' + ['','9px','3px'][compress] + '; }';
			//Segment details (closure warning)
			styles += '#edit-panel .segment .segment-details { padding: ' + ['','10px','5px'][compress] + '; padding-top: 0px; }';
			//All control labels
			styles += '#edit-panel .control-label { font-size: ' + ['','11px','10px'][compress] + '; margin-bottom: ' + ['','4px','1px'][compress] + '; }';
			//Address input
			styles += '#edit-panel .address-edit-view { cursor: pointer; margin-bottom: ' + ['','6px','2px'][compress] + '!important; }';
			styles += '#edit-panel .address-edit-input { padding: ' + ['','4px','1px'][compress] + '; font-size: ' + ['','13px','12px'][compress] + '; }';
			styles += '.tts-button { height: ' + ['','28px','21px'][compress] + '; }';
			//alt names
			styles += '.alt-street-list { margin-bottom: ' + ['','4px','0px'][compress] + '; }';
			styles += '#edit-panel .add-alt-street-form .alt-street { padding-top: ' + ['','13px','3px'][compress] + '; padding-bottom: ' + ['','13px','3px'][compress] + '; }';
			styles += '#edit-panel .add-alt-street-form .alt-street .alt-street-delete { top: ' + ['','12px','4px'][compress] + '; }';
			styles += '#edit-panel .segment .address-edit-view .address-form .action-buttons { padding-top: ' + ['','11px','6px'][compress] + '; padding-bottom: ' + ['','11px','6px'][compress] + '; margin-top: ' + ['','5px','0px'][compress] + '; height: ' + ['','45px','28px'][compress] + '; }';
			styles += '#edit-panel .add-alt-street-form .new-alt-street { padding-top: ' + ['','8px','3px'][compress] + '; padding-bottom: ' + ['','8px','3px'][compress] + '; }';
			//restrictions control
			styles += '#edit-panel .restriction-list { margin-bottom: ' + ['','5px','0px'][compress] + '; }';
			//speed limit controls
			styles += '#edit-panel .clearfix.controls.speed-limit { margin-top: ' + ['','0px','-5px'][compress] + '; }';
			styles += '#edit-panel .segment .speed-limit label { margin-bottom: ' + ['','3px','1px'][compress] + '; }';
			styles += '#edit-panel .segment .speed-limit .form-control { height: ' + ['','23px','19px'][compress] + '; padding-top: ' + ['','4px','2px'][compress] + '; font-size: ' + ['','13px','12px'][compress] + '; width: 5em; margin-left: 0px; }';
			styles += '#edit-panel .segment .speed-limit .direction-label { font-size: ' + ['','12px','11px'][compress] + '; line-height: ' + ['','2.0em','1.8em'][compress] + '; }';
			styles += '#edit-panel .segment .speed-limit .unit-label { font-size: ' + ['','12px','11px'][compress] + '; line-height: ' + ['','2.0em','1.8em'][compress] + '; margin-left: 0px;}';
			styles += '#edit-panel .segment .speed-limit .average-speed-camera { margin-left: 40px; }';
			styles += '#edit-panel .segment .speed-limit .average-speed-camera .camera-icon { vertical-align: top; }';
			styles += '#edit-panel .segment .speed-limit .verify-buttons { margin-bottom: ' + ['','5px','0px'][compress] + '; }';
			//more actions section
			styles += '#edit-panel .more-actions { padding-top: ' + ['','6px','2px'][compress] + '; }';
			styles += '#edit-panel .more-actions .waze-btn.waze-btn-white { padding-left: 0px; padding-right: 0px; }';
			//get more-actions buttons on one line
			styles += '#edit-panel .more-actions { display: inline-flex; }';
			styles += '#edit-panel .action-button { width: 155px; overflow: hidden; }';
			styles += '#edit-panel .action-button:before { margin-right: 0px !important; }';
			styles += '#edit-panel .more-actions .edit-house-numbers-btn-wrapper { margin-top: 0px; }';
			//additional attributes
			styles += '#edit-panel .additional-attributes { margin-bottom: ' + ['','3px','1px'][compress] + '; }';
			//history items
			styles += '.toggleHistory { padding: ' + ['','7px','3px'][compress] + '; }';
			styles += '.element-history-item:not(:last-child) { margin-bottom: ' + ['','3px','1px'][compress] + '; }';
			styles += '.element-history-item .tx-header { padding: ' + ['','6px','2px'][compress] + '; }';
			styles += '.element-history-item .tx-header .tx-author-date { margin-bottom: ' + ['','3px','1px'][compress] + '; }';
			styles += '.element-history-item .tx-content { padding: ' + ['','7px 7px 7px 22px','4px 4px 4px 22px'][compress] + '; }';
			styles += '.loadMoreContainer { padding: ' + ['','5px 0px','3px 0px'][compress] + '; }';
			//closures list
			styles += '.closures-list .add-closure-button { line-height: ' + ['','20px','18px'][compress] + '; }';
			styles += '.closures-list .closure-item:not(:last-child) { margin-bottom: ' + ['','6px','2px'][compress] + '; }';
			styles += '.closures-list .closure-item .details { padding: ' + ['','5px','0px'][compress] + '; font-size: ' + ['','12px','11px'][compress] + '; }';
			styles += '.closures-list .closure-item .buttons { top: ' + ['','7px','4px'][compress] + '; }';
			//tweak for Junction Box button
			styles += '#edit-panel .junction-actions > button { width: inherit; }';
			//PLACE DETAILS
			//alert
			styles += '#edit-panel .header-alert { margin-bottom: ' + ['','6px','2px'][compress] + '; padding: ' + ['','6px 32px','2px 32px'][compress] + '; }';
			//address input
			styles += '#edit-panel .full-address { padding-top: ' + ['','4px','1px'][compress] + '; padding-bottom: ' + ['','4px','1px'][compress] + '; font-size: ' + ['','13px','12px'][compress] + '; }';
			//alt names
			styles += '#edit-panel .aliases-view .list li { margin: ' + ['','12px 0','4px 0'][compress] + '; }';
			styles += '#edit-panel .aliases-view .delete { line-height: inherit; }';
			//categories
			styles += '#edit-panel .categories .select2-search-choice .category { margin: ' + ['','2px 0 2px 4px','1px 0 1px 3px'][compress] + '; height: ' + ['','18px','15px'][compress] + '; line-height: ' + ['','18px','15px'][compress] + '; }';
			styles += '#edit-panel .categories .select2-search-field input { height: ' + ['','18px','17px'][compress] + '; }';
			styles += '#edit-panel .categories .select2-choices { min-height: ' + ['','26px','19px'][compress] + '; }';
			styles += '#edit-panel .categories .select2-container { margin-bottom: 0px; }';
			//entry/exit points
			styles += '#edit-panel .navigation-point-view .navigation-point-list-item .preview { padding: ' + ['','3px 7px','0px 4px'][compress] + '; font-size: ' + ['','13px','12px'][compress] + '; }';
			styles += '#edit-panel .navigation-point-view .add-button { height: ' + ['','28px','18px'][contrast] + '; line-height: ' + ['','17px','16px'][contrast] + '; font-size: ' + ['','13px','12px'][compress] + '; }';
			//type buttons
			styles += '#sidebar .area-btn, #sidebar .point-btn { height: ' + ['','19px','16px'][compress] + '; line-height: ' + ['','19px','16px'][compress] + '; font-size: ' + ['','13px','12px'][compress] + '; }';
			// { height: ' + ['','19px','16px'][compress] + '; width: ' + ['','19px','16px'][compress] + '; line-height: ' + ['','19px','16px'][compress] + '; font-size: ' + ['','13px','12px'][compress] + '; margin-bottom: ' + ['','3px','1px'][compress] + '; }';
			//external providers
			styles += '.select2-container { font-size: ' + ['','13px','12px'][compress] + '; }';
			styles += '#edit-panel .external-providers-view .external-provider-item { margin-bottom: ' + ['','6px','2px'][compress] + '; }';
			styles += '.external-providers-view > div > ul { margin-bottom: ' + ['','4px','0px'][compress] + '; }';
			styles += '#edit-panel .external-providers-view .add { padding: ' + ['','3px 12px','1px 9px'][compress] + '; }';
			styles += '#edit-panel .waze-btn.waze-btn-smaller { line-height: ' + ['','26px','21px'][compress] + '; }';
			//residential toggle
			styles += '#edit-panel .toggle-residential { height: ' + ['','27px','22px'][compress] + '; }';
			//more info
			styles += '.service-checkbox { font-size: ' + ['','13px','12px'][compress] + '; }';
			//PARKING LOT SPECIFIC
			styles += '.parking-type-option{ display: inline-block; }';
			styles += '.payment-checkbox { display: inline-block; min-width: ' + ['','48%','31%'][compress] + '; }';
			styles += '.service-checkbox { display: inline-block; min-width: ' + ['','49%','32%'][compress] + '; font-size: ' + ['','12px','11px'][compress] + '; }';
			styles += '.lot-checkbox { display: inline-block; min-width: 49%; }';
			//MAP COMMENTS
			styles += '.map-comment-name-editor { padding: ' + ['','10px','5px'][compress] + '; }';
			styles += '.map-comment-name-editor .edit-button { margin-top: 0px; font-size: ' + ['','13px','12px'][compress] + '; padding-top: ' + ['','3px','1px'][compress] + '; }';
			styles += '.conversation-view .no-comments { padding: ' + ['','10px 15px','5px 15px'][compress] + '; }';
			styles += '.map-comment-feature-editor .conversation-view .comment-list { padding-top: ' + ['','8px','1px'][compress] + '; padding-bottom: ' + ['','8px','1px'][compress] + '; }';
			styles += '.map-comment-feature-editor .conversation-view .comment-list .comment .comment-content { padding: ' + ['','6px 0px','2px 0px'][compress] + '; }';
			styles += '.conversation-view .comment .text { padding: ' + ['','6px 9px','3px 4px'][compress] + '; font-size: ' + ['','13px','12px'][compress] + '; }';
			styles += '.conversation-view .new-comment-form { padding-top: ' + ['','10px','5px'][compress] + '; }';
			styles += '.map-comment-feature-editor .clear-btn { height: ' + ['','26px','19px'][compress] + '; line-height: ' + ['','26px','19px'][compress] + '; }';
			//Compression for WME Speedhelper
			styles += '.clearfix.controls.speed-limit { margin-top: ' + ['','-4px','-8px'][compress] + '; }';
			//Compression for WME Clicksaver
			styles += '.rth-btn-container { margin-bottom: ' + ['','2px','-1px'][compress] + '; }';
			styles += '#csRoutingTypeContainer { height: ' + ['','23px','16px'][compress] + ' !important; margin-top: ' + ['','-2px','-4px'][compress] + '; }';
			styles += '#csElevationButtonsContainer { margin-bottom: ' + ['','2px','-1px'][compress] + ' !important; }';
			//tweak for WME Clicksaver tab controls
			styles += '#sidepanel-clicksaver .controls-container { width: 100%; }';
			//tweak for JAI tab controls
			styles += '#sidepanel-ja .controls-container { width: 100%; }';
			//tweaks for UR-MP Tracker
			styles += '#sidepanel-urt { margin-left: ' + ['','-5px','0px'][compress] + ' !important; }';
			styles += '#urt-main-title { margin-top: ' + ['','-5px','0px'][compress] + ' !important; }';
		}
		if (contrast > 0) {
			//contrast enhancements
			//general
			styles += '#sidebar .form-group { border-top: 1px solid ' + ['','lightgrey','grey'][contrast] + '; }';
			//text colour
			styles += '#sidebar { color: black; }';
			//advanced tools section
			styles += '#sidebar waze-staff-tools { background-color: #c7c7c7; }';
			//Tabs
			styles += '#sidebar .nav-tabs { border: 1px solid ' + ['','lightgrey','grey'][contrast] + '; }';
			styles += '#sidebar .nav-tabs li a { border: 1px solid ' + ['','lightgrey','grey'][contrast] + ' !important; }';
			//Fix the un-noticeable feed refresh button
			styles += 'span.fa.fa-repeat.feed-refresh.nav-tab-icon { width: 19px; color: orangered; }';
			styles += 'span.fa.fa-repeat.feed-refresh.nav-tab-icon:hover { color: red; font-weight: bold; font-size: 15px; }';
			//Feed
			styles += '.feed-item { border: 1px solid ' + ['','lightgrey','grey'][contrast] + '; }';
			styles += '.feed-issue .content .title .type { color: ' + ['','black','black'][contrast] + '; font-weight: bold; }';
			styles += '.feed-issue .content .timestamp { color: ' + ['','dimgrey','black'][contrast] + '; }';
			styles += '.feed-issue .content .subtext { color: ' + ['','dimgrey','black'][contrast] + '; }';
			styles += '.feed-item .motivation { font-weight: bold; }';
			//Drives & Areas
			styles += '#sidebar .result-list .result { border: 1px solid ' + ['','lightgrey','grey'][contrast] + '; }';
			//Segment edit panel
			styles += '#edit-panel .selection { font-size: 13px; }';
			styles += '#edit-panel .segment .direction-message { color: orangered; }';
			styles += '#edit-panel .address-edit-input { color: black; border: 1px solid ' + ['','lightgrey','grey'][contrast] + '; }';
			styles += '#sidebar .form-control { border: 1px solid ' + ['','lightgrey','grey'][contrast] + '; }';
			//radio buttons when disabled
			styles += '.waze-radio-container input[type="radio"]:disabled:checked + label { color: black; opacity: 0.7; font-weight:600; }';
			//override border for lock levels
			styles += '#sidebar .waze-radio-container { border: 0 none !important; }';
			styles += '#edit-panel .waze-btn { color: black; border: 1px solid ' + ['','lightgrey','grey'][contrast] + '; }';
			styles += '.waze-radio-container label  { border: 1px solid ' + ['','lightgrey','grey'][contrast] + '; }';
			//history items
			styles += '.toggleHistory { color: black; text-align: center; }';
			styles += '.element-history-item .tx-header { color: black; }';
			styles += '.element-history-item.closed .tx-header { border-radius: 8px; border: 1px solid ' + ['','lightgrey','grey'][contrast] + '; }';
			styles += '.loadMoreHistory { border: 1px solid ' + ['','lightgrey','grey'][contrast] + '; }';
			//closures list
			styles += '.closures-list .closure-item .details { border-radius: 8px; border: 1px solid ' + ['','lightgrey','grey'][contrast] + '; }';
			styles += '.closures-list .closure-item .dates { color: black; }';
			styles += '.closures-list .closure-item .dates .date-label { opacity: 1; }';
			//Place details
			//alert
			styles += '#edit-panel .alert-danger { color: red; }';
			//address input
			styles += '#edit-panel .full-address { color: black; border: 1px solid ' + ['','lightgrey','grey'][contrast] + '; }';
			styles += '#edit-panel a.waze-link { font-weight: bold; }';
			//categories
			styles += '#edit-panel .categories .select2-search-choice .category { text-transform: inherit; font-weight: bold; background: gray; }';
			//entry/exit points
			styles += '#edit-panel .navigation-point-view .navigation-point-list-item .preview { border: 1px solid ' + ['','lightgrey','grey'][contrast] + '; }';
			styles += '#edit-panel .navigation-point-view .add-button { border: 1px solid ' + ['','lightgrey','grey'][contrast] + '; margin-top: 2px; padding: 0 5px; }';
			//type buttons
			styles += '#sidebar .point-btn { color: black; border: 1px solid ' + ['','lightgrey','grey'][contrast] + ' !important; }';
			//external providers
			styles += '.select2-container { color: teal; border: 1px solid ' + ['','lightgrey','grey'][contrast] + ' !important; }';
			styles += '.select2-container .select2-choice { color: black; }';
			//residential toggle
			styles += '#edit-panel .toggle-residential { font-weight: bold; }';
			//COMMENTS
			styles += '.map-comment-name-editor { border-color: ' + ['','darkgrey','grey'][contrast] + '; }';
		}
		//fix for buttons of WME Image Overlay script
		styles += '#sidepanel-imageoverlays > div.result-list button { height: 24px; }';
		addStyle(prefix + fname,styles);
	} else {
		removeStyle(prefix + fname);
	}
}

function compressLayersMenu() {
	var fname = arguments.callee.toString().match(/function ([^\(]+)/)[1];
	logit("function " + fname + " called", "debug");
	removeStyle(prefix + fname);
	var styles = "";
	if (_cbCompressLayersMenu.checked) {
		getId('layersColControls').style.opacity = '1';
		var contrast = _inpUIContrast.value;
		var compress = _inpUICompression.value;
		if (compress > 0) {
			//VERTICAL CHANGES
			//Change menu to autoheight
			var menuHeight = document.querySelector("#toolbar > div > div.layer-switcher-container > div > div > div > div > div.menu").style.height;
			styles += '.layer-switcher .menu { height: auto !important; max-height: ' + menuHeight + '; overflow-y: scroll; width: auto; }';
			//Shrink options toggler section
			styles += '.layer-switcher .more-options-toggle { line-height: ' + ['','27px','19px'][compress] + '; height: ' + ['','27px','19px'][compress] + '; font-size: ' + ['','12px','11px'][compress] + '; }';
			styles += '.layer-switcher .more-options-toggle .pinned { font-size: ' + ['','19px','17px'][compress] + '; width: auto; }';
			styles += '.layer-switcher .scrollable { height: calc(100% - ' + ['','29px','22px'][compress] + '); overflow-x: hidden; font-size: ' + ['','13px','12px'][compress] + '; }';
			//menu
			styles += '.layer-switcher .togglers { padding: ' + ['','6px','2px'][compress] + '; width: auto; }';
			//line spacing
			styles += '.layer-switcher .toggler { padding-top: ' + ['','2px','0px'][compress] + '; padding-bottom: ' + ['','2px','0px'][compress] + '; line-height: ' + ['','16px','15px'][compress] + '; }';
			styles += '.layer-switcher .togglers .text-checkboxes .text-checkbox { margin-top: ' + ['','-2px','-4px'][compress] + '; margin-left: ' + ['','7px','2px'][compress] + '; }';
			//group separators
			styles += '.layer-switcher .togglers .group:not(:last-child)::after { margin: ' + ['','5px -7px 5px -7px','0 -7px 0 -7px'][compress] + '; }';
			//HORIZONTAL CHANGES
			styles += '.layer-switcher .togglers .children { padding-left: ' + ['','17px','12px'][compress] + '; }';
			if (_cbLayersColumns.checked) {
				//2 column stuff
				styles += '.layer-switcher .scrollable {  columns: 2; }';
				styles += '.controls-container input[type="checkbox"]:checked + label:after { WME: FU; transform: unset; }';
				styles += 'li.group { break-inside: avoid; page-break-inside: avoid; }';
				styles += '.layer-switcher .togglers { padding-top: 0px; }';
			}
		} else {
			//2-columns not available without compression
			getId('layersColControls').style.opacity = '0.5';
		}
		if (contrast > 0) {
			//less options toggle
			styles += '.layer-switcher .more-options-toggle { color: ' + ['','#5ca6bc','#2e6170'][contrast] + '; }';
			//Group headers
			styles += '.controls-container.main.toggler { color: white; background: dimgray; }';
			styles += '.layer-switcher .toggler.main .label-text { text-transform: inherit; }';
			//labels
			styles += '.layer-switcher .togglers .children { color: ' + ['','#1e1e1e','#000000'][contrast] + '; }';
			//column rule
			styles += '.layer-switcher .scrollable { column-rule: 1px solid ' + ['','lightgrey','grey'][contrast] + '; }';
		}
		addStyle(prefix + fname,styles);
	} else {
		getId('layersColControls').style.opacity = '0.5';
		removeStyle(prefix + fname);
	}
}

function restyleReports() {
	var fname = arguments.callee.toString().match(/function ([^\(]+)/)[1];
	logit("function " + fname + " called", "debug");
	var styles = "";
	if (_cbRestyleReports.checked) {
		var contrast = _inpUIContrast.value;
		var compress = _inpUICompression.value;
		if (compress > 0) {
			//report header
			styles += '#panel-container .header { padding: ' + ['','9px 36px','1px 36px'][compress] + '; line-height: ' + ['','19px','17px'][compress] + '; }';
			styles += '#panel-container .header .dot { top: ' + ['','15px','7px'][compress] + '; }';
			//special treatment for More Information checkboxes (with legends)
			styles += '#panel-container .problem-edit .more-info .legend { left: 20px; top: 3px; }';
			styles += '#panel-container .more-info input[type="checkbox"] + label { padding-left: 33px !important; }';
			//report body
			styles += '#panel-container .body { line-height: ' + ['','15px','13px'][compress] + '; font-size: ' + ['','13px','12px'][compress] + '; }';
			//problem description
			styles += '#panel-container div.description.section > div.collapsible.content { padding: ' + ['','9px','3px'][compress] + '; }';
			//comments
			styles += '#panel-container .conversation-view .comment .comment-content { padding: ' + ['','6px 9px','2px 3px'][compress] + '; }';
			styles += '#panel-container .comment .text { padding: ' + ['','7px 9px','4px 4px'][compress] + '; }';
			//new comment entry
			styles += '#panel-container .conversation-view .new-comment-form { padding: ' + ['','8px 9px 6px 9px','1px 3px 2px 3px'][compress] + '; }';
			//send button
			styles += '#panel-container .conversation-view .send-button { padding: ' + ['','4px 16px','2px 12px'][compress] + '; box-shadow: ' + ['','3px 3px 4px 0 #def7ff','3px 2px 4px 0 #def7ff'][compress] + '; }';
			//lower buttons
			styles += '#panel-container > div > div > div.actions > div > div { WME: FU; padding-top: ' + ['','6px','3px'][compress] + '; }';
			styles += '#panel-container .close-details.section { font-size: ' + ['','13px','12px'][compress] + '; line-height: ' + ['','13px','9px'][compress] + '; }';
			styles += '#panel-container .problem-edit .actions .controls-container label { WME: FU; height: ' + ['','28px','21px'][compress] + '; line-height: ' + ['','28px','21px'][compress] + '; margin-bottom: ' + ['','5px','2px'][compress] + '; }';
			styles += '#panel-container .waze-plain-btn { height: ' + ['','30px','20px'][compress] + '; line-height: ' + ['','30px','20px'][compress] + '; }';
			styles += '.panel .navigation { margin-top: ' + ['','6px','2px'][compress] + '; }';
			//WMEFP All PM button
			styles += '#WMEFP-UR-ALLPM { top: ' + ['','5px','0px'][compress] + ' !important; }';
		}
		if (contrast > 0) {
			styles += '#panel-container .section { border-bottom: 1px solid ' + ['','lightgrey','grey'][contrast] + '; }';
			styles += '#panel-container .close-panel { border-color: ' + ['','lightgrey','grey'][contrast] + '; }';
			styles += '#panel-container .main-title { font-weight: 900; }';
			styles += '#panel-container .reported { color: ' + ['','dimgrey','black'][contrast] + '; }';
			styles += '#panel-container .date { color: ' + ['','#6d6d6d','#3d3d3d'][contrast] + '; }';
			styles += '#panel-container .comment .text { border: 1px solid ' + ['','lightgrey','grey'][contrast] + '; }';
			styles += '#panel-container .comment-content.reporter .username { color: ' + ['','#159dc6','#107998'][contrast] + '; }';
			styles += '#panel-container .conversation-view .new-comment-form textarea { border: 1px solid ' + ['','lightgrey','grey'][contrast] + '; }';
			styles += '#panel-container .top-section { border-bottom: 1px solid ' + ['','lightgrey','grey'][contrast] + '; }';
			styles += '#panel-container .waze-plain-btn { font-weight: 800; color: ' + ['','#159dc6','#107998'][contrast] + '; }';
		}
		addStyle(prefix + fname,styles);
		if (wmeFUinitialising) {
			setTimeout(draggablePanel, 5000);
		} else {
			draggablePanel();
		}
	} else {
		removeStyle(prefix + fname);
		if (jQuery.ui) {
			if ( $("#panel-container").hasClass('ui-draggable') ) {
				$("#panel-container").draggable("destroy");
			}
			getId("panel-container").style = "";
		}
	}
	window.dispatchEvent(new Event('resize'));
}

function draggablePanel() {
	if (jQuery.ui) {
		if ($("#panel-container").data("ui-draggable")) {
			$("#panel-container").draggable({ handle: ".header" });
		}
	}
}

function enhanceChat() {
	var fname = arguments.callee.toString().match(/function ([^\(]+)/)[1];
	logit("function " + fname + " called", "debug");
	var styles = "";
	if (_cbEnhanceChat.checked) {
		removeStyle(prefix + fname);
		var contrast = _inpUIContrast.value;
		var compress = _inpUICompression.value;
		var mapX = getId('map').clientWidth;
		var mapY = getId('map').clientHeight;
		var chatX = Math.floor( mapX * 0.45);
		var chatY = Math.floor( mapY * 0.5);
		var chatHeaderY = [50,35,20][compress];
		var chatMessageInputY = [39,31,23][compress];
		var chatMessagesY = chatY - chatHeaderY - chatMessageInputY;
		var chatUsersY = chatY - chatHeaderY;
		//change chat width to 45% of map view
		styles += '#chat-overlay { width: ' + chatX + 'px; min-width: 334px; }'; //14px added for Chat addon
		styles += '#chat .messages { width: 70%; min-width: 200px;}';
		styles += '#map.street-view-mode #chat .messages { width: 70%; }';
		styles += '#chat .messages .message-list { margin-bottom: 0px; }';
		styles += '#chat .messages .new-message { position: inherit; width: unset; }';
		styles += '#map.street-view-mode #chat .messages .new-message { position: inherit; width: unset; }';
		styles += '#chat .users { width: 30%; min-width: 120px; }';
		styles += '#chat .messages .message-list .message.normal-message { max-width: unset; }';
		//change chat height to 50% of map view
		styles += '#chat .messages .message-list { min-height: ' + chatMessagesY + 'px; }';
		styles += '#chat .users { max-height: ' + chatUsersY + 'px; }';
		
//		#chat .messages .unread-messages-notification width=70%, bottom64px>
		if (compress > 0) {
			//do compression
			//header
			styles += '#chat .header { line-height: ' + chatHeaderY + 'px; }';
			
			styles += '#chat .header .dropdown .dropdown-toggle { line-height: ' + ['','30px','19px'][compress] + '; }';
			styles += '#chat .header button { line-height: ' + ['','20px','19px'][compress] + '; font-size: ' + ['','13px','11px'][compress] + '; height: ' + ['','20px','19px'][compress] + '; }';
			//message list
			styles += '#chat .messages .message-list { padding: ' + ['','9px','3px'][compress] + '; }';
			styles += '#chat .messages .message-list .message.normal-message { padding: ' + ['','6px','2px'][compress] + '; }';
			styles += '#chat .messages .message-list .message { margin-bottom: ' + ['','8px','2px'][compress] + '; line-height: ' + ['','16px','14px'][compress] + '; font-size: ' + ['','12px','11px'][compress] + '; }';
			styles += '#chat .messages .new-message input { height: ' + chatMessageInputY + 'px; }';
			//user list
			styles += '#chat .users { padding: ' + ['','8px','1px'][compress] + '; }';
			styles += '#chat ul.user-list a.user { padding: ' + ['','2px','1px'][compress] + '; }';
			styles += '#chat ul.user-list a.user .rank { width: ' + ['','25px','20px'][compress] + '; height: ' + ['','20px','16px'][compress] + '; margin-right: ' + ['','3px','1px'][compress] + '; }';
			styles += '#chat ul.user-list a.user .username { line-height: ' + ['','21px','17px'][compress] + '; }';
			styles += '#chat ul.user-list a.user:hover .crosshair { margin-top: ' + ['','3px','1px'][compress] + '; right: ' + ['','3px','1px'][compress] + '; }';
			//fix for WME Chat Addon
			styles += '#chat .users > ul > li > a { margin: 0px !important; }';
		}
		if (contrast > 0) {
			//header
			styles += '#chat .header { color: black; background-color: ' + ['','#d9d9d9','#bfbfbf'][contrast] + '; }';
			styles += '#chat .messages .message-list { background-color: ' + ['','#e8e8e8','lightgrey'][contrast] + '; }';
			styles += '#chat .messages .message-list .message.normal-message { color: black; float: left; }';
			styles += '#chat .messages .message-list .message.normal-message .from { color: dimgrey; font-weight: bold; font-style: italic; }';
			styles += '#chat .messages .message-list .message.own-message .from { color: black; background-color: #a1dcf5; }';
			//user message timestamps
			styles += '#chat > div.chat-body > div.messages > div.message-list > div > div.from > span { color: ' + ['','dimgrey','black'][contrast] + ' !important; }';
			//system message timestamps
			styles += '#chat > div.chat-body > div.messages > div.message-list > div > div.body > div > span { color: ' + ['','dimgrey','black'][contrast] + ' !important; }';
			//fix for WME Chat Addon
			styles += '#chat .body > div { color: black !important; }';
		}
		//fix for Chat Addon timestamps running up against names
		styles += '#chat > div.chat-body > div.messages > div.message-list > div > div.from > span { margin-left: 5px; }';
		addStyle(prefix + fname,styles);
	} else {
		removeStyle(prefix + fname);
	}
}

function narrowSidePanel() {
	var fname = arguments.callee.toString().match(/function ([^\(]+)/)[1];
	logit("function " + fname + " called", "debug");
	var styles = "";
	if (_cbNarrowSidePanel.checked) {
		//sidebar width
		styles += '.row-fluid #sidebar { width: 250px; }';
		//map width
		styles += '.show-sidebar .row-fluid .fluid-fixed { margin-left: 250px; }';
		//user info tweaks
		styles += '#sidebar #user-info #user-box { padding: 0 0 5px 0; }';
		styles += '#sidebar #user-details { width: 250px; }';
		styles += '#sidebar #user-details .user-profile .level-icon { margin: 0; }';
		styles += '#sidebar #user-details .user-profile .user-about { max-width: 161px; }';
		//gradient bars
		styles += '#sidebar .tab-scroll-gradient { width: 220px; }';
		styles += '#sidebar #links:before { width: 236px; }';
		//feed
		styles += '.feed-item .content { max-width: 189px; }';
		//segment edit panel
		styles += '#edit-panel .more-actions .waze-btn.waze-btn-white { width: 122px; }';
		//tweak for WME Bookmarks
		styles += '#divBookmarksContent .divName { max-width: 164px; }';
		addStyle(prefix + fname, styles);
	} else {
		removeStyle(prefix + fname);
	}
	compressSegmentTab();
	window.dispatchEvent(new Event('resize'));
}

function shiftAerials() {
	var fname = arguments.callee.toString().match(/function ([^\(]+)/)[1];
	logit("function " + fname + " called", "debug");
	// calculate meters/pixel for current map view
	var ipu = OL.INCHES_PER_UNIT;
	var metersPerPixel = W.map.getResolution() * ipu.m / ipu[W.map.getUnits()];
	// Apply the shift and opacity
	W.map.baseLayer.div.style.left = Math.round(getId("_inpASX").value / metersPerPixel) + 'px';
	W.map.baseLayer.div.style.top = Math.round(- getId("_inpASY").value / metersPerPixel) + 'px';
	W.map.baseLayer.div.style.opacity = getId("_inpASO").value/100;
	if (getId("_inpASX").value != 0 || getId("_inpASY").value != 0) {
		getId("WMEFU_AS").style.display = "block";
	} else {
		getId("WMEFU_AS").style.display = "none";
	}
	//turn off Enhance Chat if WME Chat Fix is loaded
	if (document.getElementById('WMEfixChat-setting')) {
		if (_cbEnhanceChat.checked === true) {
			alert("WME FixUI: Enhance Chat disabled because WME Chat UI Fix detected");
		}
		_cbEnhanceChat.checked = false;
	}
}

function fixExternalProviders () {
	var fname = arguments.callee.toString().match(/function ([^\(]+)/)[1];
	logit("function " + fname + " called", "debug");
	var styles = "";
	if (_cbFixExternalProviders.checked) {
		//enlarge external provider boxes
		styles += '#edit-panel .external-providers-view .select2-container { width: 90%; margin-bottom: 2px; }';
		styles += '.select2-container .select2-choice { height: inherit; line-height: 16px; }';
		styles += '.select2-container .select2-choice>.select2-chosen { white-space: normal; }';
		styles += '.placeId { padding-bottom: 5px; }';
		addStyle(prefix + fname,styles);
	} else {
		removeStyle(prefix + fname);
	}
}

function warnCommentsOff() {
	var fname = arguments.callee.toString().match(/function ([^\(]+)/)[1];
	logit("function " + fname + " called", "debug");
	if (W.map.getLayerByUniqueName('mapComments').visibility === false) {
		removeStyle(prefix + fname);
		addStyle(prefix + fname, '.toolbar { background-color: #FFC107; }');
	} else {
		removeStyle(prefix + fname);
	}
	// extra bit because killNodeLayer will be inactive
	getId("_btnKillNode").innerHTML = "Hide junction nodes";
	getId("_btnKillNode").style.backgroundColor = "";
}

function adjustGSV() {
	var fname = arguments.callee.toString().match(/function ([^\(]+)/)[1];
	logit("function " + fname + " called", "debug");
	var styles = "";
	styles += '.gm-style { filter: contrast(' + getId('_inpGSVContrast').value + '%) ';
	styles += 'brightness(' + getId('_inpGSVBrightness').value + '%) ';
	if (getId('_cbGSVInvert').checked) {
		styles += 'invert(1); }';
	} else {
		styles += 'invert(0); }';
	}
	removeStyle(prefix + fname);
	addStyle(prefix + fname, styles);
}


function permalinkCheck() {
	var fname = arguments.callee.toString().match(/function ([^\(]+)/)[1];
	logit("function " + fname + " called", "debug");
	//clear any further calls
	clearTimeout(PLCheckTimer);
	W.selectionManager.events.unregister("selectionchanged", null, permalinkCheck);
	//create array of selected segment IDs
	SMSegments = [];
	if (W.selectionManager.getSelectedFeatures().length > 0) {
		for (i=0; i<W.selectionManager.getSelectedFeatures().length; i++) {
			SMSegments.push(W.selectionManager.getSelectedFeatures()[i].model.attributes.id.toString());
		}
	}
	if (SMSegments.length == 0) {
		//no selected segments - so we must have been called from the timeout
		alert("WARNING FROM WME FixUI!\n\n" +
		"You have opened a permalink with " + URLSegments.length + " segments, but no segments have " +
		"been selected after 10 seconds.\n\n" +
		"The permalink may contain segments not selectable at this zoom, or not " +
		"visible on-screen, or some segment IDs may have been changed since the " +
		"permalink was created.\n\n" + 
		"Or WME may just be loading very slowly.");
	} else {
		//Some selected segments - so we need to compare
		for ( i = 0; i < URLSegments.length; i++) {
			if (!SMSegments.includes(URLSegments[i])) {
				//found a URL segment that isn't currently selected
				//need to delay the warning so WME can display the selection
				setTimeout(PLWarning, 1000);
				break;
			}
		}
	}
}

function PLWarning() {
	alert("WARNING FROM WME FixUI!\n\n" +
	"You have opened a permalink with " + URLSegments.length + " segments, but they do not match the " +
	"segments now selected in WME.\n\n" +
	"The permalink may contain segments not selectable at this zoom, " +
	"or not visible on-screen, or some segment IDs may have been " +
	"changed since the permalink was created.\n\n" +
	"It is also possible no segments were selected when WME loaded " +
	"and you have manually selected something.");
}

function moveChatIcon() {
	var fname = arguments.callee.toString().match(/function ([^\(]+)/)[1];
	logit("function " + fname + " called", "debug");
	var styles = "";
	if (_cbMoveChatIcon.checked) {
		styles += '#chat-overlay { left: inherit !important; right: 30px !important; }';
		styles += '#chat-overlay #chat-toggle { right: 0px !important; }';
		addStyle(prefix + fname,styles);
	} else {
		removeStyle(prefix + fname);
	}
}

function highlightInvisible() {
	var fname = arguments.callee.toString().match(/function ([^\(]+)/)[1];
	logit("function " + fname + " called", "debug");
	var styles = "";
	if (_cbHighlightInvisible.checked) {
		styles += '#chat-overlay.visible-false #chat-toggle button { filter: none; background-color: #ff0000c0; }';
		addStyle(prefix + fname,styles);
	} else {
		removeStyle(prefix + fname);
	}
}

function darkenSaveLayer() {
	var fname = arguments.callee.toString().match(/function ([^\(]+)/)[1];
	logit("function " + fname + " called", "debug");
	var styles = "";
	if (_cbDarkenSaveLayer.checked) {
		//don't publish without alteration!
		styles += '#popup-overlay { background-color: dimgrey !important; }';
		addStyle(prefix + fname,styles);
	} else {
		removeStyle(prefix + fname);
	}
}

function swapRoadsGPS() {
	var fname = arguments.callee.toString().match(/function ([^\(]+)/)[1];
	logit("function " + fname + " called", "debug");
	var styles = "";
	if (_cbSwapRoadsGPS.checked) {
		var roadLayerId = W.map.getLayerByUniqueName("roads").id;
		var GPSLayerId = W.map.getLayerByUniqueName("gps_points").id;
		var roadLayerZ = W.map.getLayerByUniqueName("roads").getZIndex();
		var GPSLayerZ = W.map.getLayerByUniqueName("gps_points").getZIndex();
		logit("Layers identified\n\tRoads: " + roadLayerId + "," + roadLayerZ + "\n\tGPS: " + GPSLayerId + "," + GPSLayerZ, "info");
		styles += '#' + roadLayerId.replace(/\./g,"\\2e") + ' { z-index: ' + GPSLayerZ + ' !important; }';
		styles += '#' + GPSLayerId.replace(/\./g,"\\2e") + ' { z-index: ' + roadLayerZ + ' !important; }';
		addStyle(prefix + fname,styles);
	} else {
		removeStyle(prefix + fname);
	}
}

function killNode() {
	var fname = arguments.callee.toString().match(/function ([^\(]+)/)[1];
	logit("function " + fname + " called", "debug");
	getId(W.map.getLayerByUniqueName("nodes").id + "_root").style.display = "none";
	getId("_btnKillNode").style.backgroundColor = "yellow";
	getId("_btnKillNode").innerHTML = "Junction nodes hidden!";
}

function undarkenAerials() {
	var fname = arguments.callee.toString().match(/function ([^\(]+)/)[1];
	logit("function " + fname + " called", "debug");
	var styles = "";
	if (_cbUndarkenAerials.checked) {
		styles += '.olTileImage { filter: none !important; }'; // for current production WME
		styles += '.satellite-overlay { display: none !important; }'; //for current beta WME
		addStyle(prefix + fname,styles);
	} else {
		removeStyle(prefix + fname);
	}
}

function showMapBlockers() {
	var fname = arguments.callee.toString().match(/function ([^\(]+)/)[1];
	logit("function " + fname + " called", "debug");
	var styles = "";
	if (_cbShowMapBlockers.checked) {
		styles += '.street-view-layer { background-color: rgba(255,0,0,0.3); }';
		styles += '.live-user-marker { background-color: rgba(255,0,0,0.3); }';
		styles += '#overlay-buttons { background-color: rgba(255,0,0,0.3); }';
		addStyle(prefix + fname,styles);
	} else {
		removeStyle(prefix + fname);
	}
}

function fixBridgeButton() {
	var fname = arguments.callee.toString().match(/function ([^\(]+)/)[1];
	logit("function " + fname + " called", "debug");
	var styles = "";
	if (_cbFixBridgeButton.checked) {
		styles += '.add-bridge { margin-top: -41px; width: 36px; height: 30px; background-position: -2px -1px; } .add-bridge:hover { background-position: -42px 0px; }';
		addStyle(prefix + fname,styles);
	} else {
		removeStyle(prefix + fname);
	}
}

function disableBridgeButton() {
	var fname = arguments.callee.toString().match(/function ([^\(]+)/)[1];
	logit("function " + fname + " called", "debug");
	var styles = "";
	if (_cbDisableBridgeButton.checked) {
		styles += '.add-bridge { pointer-events: none; opacity: 0.4; }';
		addStyle(prefix + fname,styles);
	} else {
		removeStyle(prefix + fname);
	}
}

function hideLinks() {
	var fname = arguments.callee.toString().match(/function ([^\(]+)/)[1];
	logit("function " + fname + " called", "debug");
	var styles = "";
	if (_cbHideLinks.checked) {
		//Nuke the links at the bottom of the side panel
		styles += '#sidebar waze-links { display: none; }';
		//extend side panel to the bottom
		styles += '#edit-panel { height: calc(100% + 25px); }';
		addStyle(prefix + fname,styles);
	} else {
		removeStyle(prefix + fname);
	}
}

function disableKinetic() {
	var fname = arguments.callee.toString().match(/function ([^\(]+)/)[1];
	logit("function " + fname + " called", "debug");
	if (_cbDisableKinetic.checked) {
		W.map.controls.find(control => control.dragPan).dragPan.kinetic = null;
	} else {
		W.map.controls.find(control => control.dragPan).dragPan.kinetic = kineticDragParams;
	}
}

function disableScrollZoom() {
	var fname = arguments.callee.toString().match(/function ([^\(]+)/)[1];
	logit("function " + fname + " called", "debug");
	if (_cbDisableScrollZoom.checked) {
		W.map.navigationControl.disableZoomWheel();
	} else {
		W.map.navigationControl.enableZoomWheel();
	}
}

function PSclicked() {
	var fname = arguments.callee.toString().match(/function ([^\(]+)/)[1];
	logit("function " + fname + " called", "debug");
	if (W.selectionManager.getSelectedFeatures().length > 0) {
		if (getId("user-info").style.display == "none") {
			getId("user-info").style.display = "block";
		} else {
			getId("user-info").style.display = "none";
		}
	}
}

function PSicon() {
	var fname = arguments.callee.toString().match(/function ([^\(]+)/)[1];
	logit("function " + fname + " called", "debug");
	if (W.selectionManager.getSelectedFeatures().length > 0) {
		getId("WMEFUPS").style.color = "red";
	} else {
		getId("WMEFUPS").style.color = "lightgrey";
	}
}

function addGlobalStyle(css) {
	var head, style;
	head = document.getElementsByTagName('head')[0];
	if (!head) {
		return;
	}
	style = document.createElement('style');
	style.type = 'text/css';
	style.innerHTML = css;
	head.appendChild(style);
}

function addStyle(ID, css) {
	var head, style;
	head = document.getElementsByTagName('head')[0];
	if (!head) {
		return;
	}
	removeStyle(ID); // in case it is already there
	style = document.createElement('style');
	style.type = 'text/css';
	style.innerHTML = css;
	style.id = ID;
	head.appendChild(style);
}

function removeStyle(ID) {
	var style = document.getElementById(ID);
	if (style) { style.parentNode.removeChild(style); }
}

function getElementsByClassName(classname, node) {
	if(!node) { node = document.getElementsByTagName("body")[0]; }
	var a = [];
	var re = new RegExp('\\b' + classname + '\\b');
	var els = node.getElementsByTagName("*");
	for (var i=0,j=els.length; i<j; i++) {
		if (re.test(els[i].className)) { a.push(els[i]); }
	}
	return a;
}

function getId(node) {
	return document.getElementById(node);
}

function ChromeWarning () {     
	var m = navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./);
	var CV = ( m ? parseInt(m[2], 10) : false);
	if (CV) {
		if (CV <62) {
			return '\nWARNING: OUTDATED CHROME VERSION ' + CV + ' DETECTED.\nSettings saving may not work properly and update notice\nwill probably appear every time WME FixUI runs.\n';
		} else {
			return '';
		}
	} else {
		return '';
	}
}

function logit(msg, typ) {
	if (!typ) {
		console.log(prefix + ": " + msg);
	} else {
		switch(typ) {
			case "error":
				console.error(prefix + ": " + msg);
				break;
			case "warning":
				console.warn(prefix + ": " + msg);
				break;
			case "info":
				console.info(prefix + ": " + msg);
				break;
			case "debug":
				if (debug) {
					console.warn(prefix + ": " + msg);
				}
				break;
			default:
				console.log(prefix + " unknown message type: " + msg);
				break;
		}
	}
}

// Start it running
setTimeout(init1, 200);
})();
