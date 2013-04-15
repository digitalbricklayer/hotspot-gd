// Copyright (c) 2006 OPENXTRA Ltd.
// All rights reserved

// Array of current values from the device
var currentReadings = Array();

// Either the IP address or host name of the Sensatronics device
var deviceAddress = "";

// The device from which the values will be read
var device = null;

// Display area that displays the current reading
var currentValueContent = null;

var itemToReadingMap = new Object();

plugin.onShowOptionsDlg = onShowOptionsDialog;

function onOpen() {
	loadSettings();
	// Device address will be empty until the user adds a sensor to read in the options dialog
	if (deviceAddress != "") {
		startLiveDisplay();
	}
}

function startLiveDisplay() {
	initialiseDisplay();
	createDevice();
	updateReadings();
	startStatsUpdateTimer();
}

function createDevice() {
  try {
    device = new ActiveXObject("SensatronicsSDK.SensatronicsModelE");
		debug.trace("deviceAddress: " + deviceAddress);
		device.IpAddress = deviceAddress;
  } catch (e) {
    debug.error("Error: Failed to load the SensatronicsSDK.SensatronicsModelE object");
    event.returnValue = false;
    return;
  }
}

function initialiseDisplay() {
	view.caption = strTitle;
	view.resizable = true;
	contentArea.contentFlags = gddContentFlagHaveDetails;
	// Can't have more than 16 readings on a sensor
	contentArea.maxContentItems = 16;
}

function drawItem(item, target, graphics, x, y, width, height) {
  graphics.DrawText(x, y, width, height, item.heading, gddColorNormalText, 
    gddTextFlagCenter, gddFontNormal);
}

function getItemHeight(item, target, graphics, width) {
	// Return the height of the container
	return contentArea.height;
}

function updateReadings() {
	try {
		clearReadings();
		device.Poll();
		var readingCounter = 0;
		var probes = device.Probes;
		for (var probeCounter = 1; probeCounter <= probes.Count; probeCounter++) {
			var probe = probes.Item(probeCounter);
			var dataPoint = probe.MostRecentDataPoint;
			var nullValue;
			switch (device.Type) {
				case "EM1":
					nullValue = -999.0;
					break;

				case "E4":
				case "E16":
				case "ModelF":
				default:
					nullValue = -99.0;
					break;
			}

			if (dataPoint.Value > nullValue) {
				var valueWithUnit = dataPoint.Value+ " " + dataPoint.Unit;
				currentReadings[readingCounter++] = new Array(probe.Name, probe.Group, probe.Number, valueWithUnit, probe.MostRecentDataPoint.Time);
			}
		}
		updateDisplay();
	} catch (e) {
    debug.error("UpdateReadings: failed: " + e);
	}
}

function clearReadings() {
	// Clean out the existing readings
	currentReadings.length = 0;
}

function updateDisplay() {
	contentArea.removeAllContentItems();
	var vbarrItems = contentArea.contentItems;
	if (vbarrItems != null) {
		dispcount = contentArea.maxContentItems;
		if (dispcount > currentReadings.length) {
			dispcount = currentReadings.length;
		}
		for (var i = dispcount-1; i >= 0; i--) {
			curItem = new ContentItem();
			curItem.flags = gddContentItemFlagNoRemove;

			// The probe name is the detail heading
			curItem.heading = currentReadings[i][0];
			// The source of the info
			curItem.source = "Probe: " + currentReadings[i][2] + " Device: " + device.IpAddress + " @ " + currentReadings[i][4];
			curItem.open_command = "http://" + device.IpAddress + "/";
			curItem.snippet = formatSnippet(currentReadings[i]);

			// Map the reading info onto the content item used to display it
			itemToReadingMap[currentReadings[i][2]] = currentReadings[i][0] + ":" + currentReadings[i][1] + ":" + currentReadings[i][2] + ":" + currentReadings[i][3];
 
			curItem.onDrawItem = drawReadingItem;
			curItem.onGetHeight = getItemHeight;
			contentArea.addContentItem(curItem, gddItemDisplayInSidebar);
		}
	}
}

function drawReadingItem(item, target, graphics, x, y, width, height) {
	graphics.DrawRect(x, y-4, width, height+4, "#fcfabf","#FFFFF0");

	// Decode the reading fields held in the content item's source
	var probeNumber = decodeProbeNumberFromSource(item.source);
	debug.trace("ProbeNumber: " + probeNumber);
	var readingInfoToDecode = itemToReadingMap[probeNumber];
	var reg = /(.+):(.+):(.+):(.+)/i;
	var ar = reg.exec(readingInfoToDecode);
	if (!ar || ar.length < 5) {
		debug.error("drawReadingItem failed: " + readingInfoToDecode);
	} else {
		// A match was made, so retreive the fields
		name = ar[1];
		group = ar[2];
		number = ar[3];
		value = ar[4];
		
		debug.trace("Name: " + name + " group: " + group + " number: " + number + " value: " + value);
	
		graphics.DrawText(x, y, width, height, value, "#0000f0", gddTextFlagVCenter, gddFontSnippet);
		graphics.DrawText(x+50, y, width, height, name.toUpperCase(), "#000000", gddTextFlagVCenter, gddFontSnippet);
		graphics.DrawText(x+140, y, width, height, group, "#000000", gddTextFlagVCenter, gddFontSnippet);
		graphics.DrawText(x+170, y, width, height, number, "#000000", gddTextFlagVCenter, gddFontSnippet);
	}
}

function decodeProbeNumberFromSource(source) {
	var number = -1;

	var reg = /Probe: (.+) Device:/i;
	var ar = reg.exec(source);
	if (!ar || ar.length < 2) {
    debug.error("decodeProbeNumberFromSource failed: " + source);
	} else {
		// A match was made, so retreive the number
		number = ar[1];
    debug.trace("Number is: " + number);
	}
	return number;
}

function getItemHeight(item, target, graphics, width) {
	maxht = graphics.GetTextHeight(item.heading, width, 0, gddFontNormal);
	return maxht;
}

function saveSettings() {
	if (!options.exists("device_address")) {
		options.add("device_address", deviceAddress);
	} else {
		options("device_address") = deviceAddress;
	}
}

function loadSettings() {
	if (options.exists("device_address")) {
		deviceAddress = options("device_address");
	} else {
		deviceAddress = "";
	}
}

function startStatsUpdateTimer() {
	setInterval("updateReadings()", 30 * 1000);
}

function formatSnippet(currentReading) {
	var snipstr = "";
	
	name = currentReading[0];
	group = currentReading[1];
	number = currentReading[2];
	value = currentReading[3];
	
	snipstr += "\nProbe name\t: " + name;
	snipstr += "\nGroup number\t: " + group;
	snipstr += "\nProbe number\t: " + number;
	snipstr += "\nProbe value\t: " + value;
	
	return snipstr;
}

function onShowOptionsDialog(wnd) {
	wnd.AddControl(gddWndCtrlClassLabel, 0, "", "IP Address:", 10, 18, 76, 16);
	wnd.AddControl(gddWndCtrlClassEdit, 0, "host_edit", deviceAddress, 86, 16, 140, 22);

	wnd.onClose = onOptionsDialogClosed;
}

function onOptionsDialogClosed(wnd, code) {
	if (code == gddIdOK) {
		var editCtrl = wnd.GetControl("host_edit");
		deviceAddress = editCtrl.value;
		saveSettings();
		startLiveDisplay();
	}
}
