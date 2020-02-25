//    spectrum-to-rgb.jsx 0.0.1
//    Illustrator/InDesign script to create swatches from absorption spectra
//    Copyright 2020 Sergey Slyusarev
//
//    This program is free software: you can redistribute it and/or modify
//    it under the terms of the GNU General Public License as published by
//    the Free Software Foundation, either version 3 of the License, or
//    (at your option) any later version.
//
//    This program is distributed in the hope that it will be useful,
//    but WITHOUT ANY WARRANTY; without even the implied warranty of
//    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//    GNU General Public License for more details.
//
//    You should have received a copy of the GNU General Public License
//    along with this program.  If not, see <http://www.gnu.org/licenses/>.

//
// Current spectrum
//

var currentSpectrum = {}

currentSpectrum.parseDelimitedFile = function(fileContents, delimiter){
	var newLinePattern = new RegExp("(.+)\\n","gi")
	var linePattern = new RegExp("([^" + delimiter + "]+)","gi")
	var columnsAsVectors = [];
	var lineMatches = null;
	var arrMatches = null;
	var maxRowLength = 0;
	while(lineMatches = newLinePattern.exec(fileContents)){
		if (String(lineMatches).substring(0, 1) != "#"){
			var lineVector = [];	
			while(arrMatches = linePattern.exec(lineMatches[0])){
				lineVector.push(arrMatches[0]);	
			};
			if (lineVector.length > maxRowLength){
				maxRowLength = lineVector.length;
			};
			for (var j = 0; j < lineVector.length; j++){
				if (typeof columnsAsVectors[j] === 'undefined'){
					columnsAsVectors.push([]);
				};
				columnsAsVectors[j].push(lineVector[j]);
			};
		};
	};
	if(maxRowLength < 2){
		alert("Invalid file, possibly wrong delimiter");
		return false;
	} else {
		return(columnsAsVectors);
	};
};

currentSpectrum.convertAndInterpolate = function(someTable, wavelengthColumn, valueColumn){
	var resultTable = {};
	// Browse through all visible wavelengths
	for (var i = this.minWL; i <= this.maxWL; i = i + this.stepWL){
		var nearestLow = 0;
		var nearestHigh = 1000;
		var nearestLowIndex = 0;
		var nearestHighIndex = 0;
		for (var j = 0; j < someTable[wavelengthColumn].length; j++){
			if (!isNaN(someTable[wavelengthColumn][j]) & !isNaN(someTable[valueColumn][j])){
				var currentWavelength = Number(someTable[wavelengthColumn][j]);
				var distToValue = currentWavelength - i;
				if (distToValue > 0){
					if (distToValue < nearestHigh - i){
						nearestHigh = currentWavelength;
						nearestHighIndex = j;
					};
				} else if (distToValue < 0) {
					if (distToValue > nearestLow - i){
						nearestLow = currentWavelength;
						nearestLowIndex = j;
					};
				} else if (distToValue == 0) {
					nearestHigh = currentWavelength;
					nearestHighIndex = j;
					nearestLow = currentWavelength;
					nearestLowIndex = j;
				};
			};
		};
		var neareatLowWavelength = Number(someTable[valueColumn][nearestLowIndex]);
		var neareatHighWavelength = Number(someTable[valueColumn][nearestHighIndex]);
		if ((nearestLow > 0) & (nearestHigh < 1000)){
			if (nearestHigh - nearestLow > 0){
				var valuePosition = (i - nearestLow)/(nearestHigh - nearestLow);
				var matchingValue = neareatLowWavelength*(1-valuePosition) + neareatHighWavelength*(valuePosition);
			} else {
				var matchingValue = neareatLowWavelength;
			};
		} else {
			if (nearestLow == 0){
				var matchingValue = neareatHighWavelength;
			};
			if (nearestHigh == 1000){
				var matchingValue = neareatLowWavelength;
			};
		};
		
		resultTable["" + i] = Math.abs(matchingValue);
	};
	return resultTable;
};

currentSpectrum.readSpectrumCSV = function(filename, delimiter, wavelengthColumn, valueColumn){
	if (typeof wavelengthColumn === 'undefined'){
		wavelengthColumn = 0;
	};
	if (typeof valueColumn === 'undefined'){
		valueColumn = 1;
	};
	var file = File(filename);
	file.open("r");   
	var fileContents = file.read();  
	file.close(); 
	var rawCSV = this.parseDelimitedFile(fileContents, delimiter);
	if (rawCSV != false){
		var processedCSV = this.convertAndInterpolate(rawCSV, wavelengthColumn, valueColumn, this.minWL, this.maxWL, this.stepWL);
		return processedCSV;
	} else {
		return false;
	};
};

currentSpectrum.determineSpectrumMaximum = function(){
	this.spectrumMaximum = (function(x){
		var rv = 0;
		for (var i in x){
			if (x[i]>rv){
				rv = x[i];
			};
		};
		return rv;
	})(this.spectrum);
};

currentSpectrum.spectrumToXYZ = function(lcFactor){
	if (typeof lcFactor === 'undefined'){
		lcFactor = this.lcFactor;
	};
	var N = 0;
	var X = 0;
	var Y = 0;
	var Z = 0;
	for (var i in this.spectrum){
		var transmittance = this.absorbanceToTransmittance(this.spectrum[i], lcFactor);
		N = N + this.observer.Y[i]*this.illuminant[i];
		X = X + this.observer.X[i]*transmittance*this.illuminant[i];
		Y = Y + this.observer.Y[i]*transmittance*this.illuminant[i];
		Z = Z + this.observer.Z[i]*transmittance*this.illuminant[i];
	};
	return [X/N, Y/N, Z/N];
};

currentSpectrum.absorbanceToTransmittance = function(absorbance, lc){
	return Math.pow(10,-(absorbance*lc));
};


// Conversion data comes from here: http://www.adobe.com/digitalimag/pdfs/AdobeRGB1998.pdf
currentSpectrum.XYZtoAdobeRGB = function(XYZ){
	var M = [
		[2.04159,	-0.56501,	-0.34473],
		[-0.96924,	1.87597,	0.04156],
		[0.01344,	-0.11836,	1.01514]
		];
	var gamma = function(x){
		return Math.pow(x, 1/(563/256));
	};
	var Xw = 152.07;
	var Yw = 160;
	var Zw = 174.25;
	var X = XYZ[0]*Yw; // Instead of 100 i use precisely white here, so absolutely transparent sample looks white
	var Y = XYZ[1]*Yw;
	var Z = XYZ[2]*Yw;
	var Xk = 0.5282;
	var Yk = 0.5557;
	var Zk = 0.6052;
	var Xn = ((X - Xk)/(Xw - Xk))*(Xw/Yw);
	var Yn = ((Y - Yk)/(Yw - Yk));
	var Zn = ((Z - Zk)/(Zw - Zk))*(Zw/Yw);
	var R = M[0][0]*Xn + M[0][1]*Yn + M[0][2]*Zn;
	var G = M[1][0]*Xn + M[1][1]*Yn + M[1][2]*Zn;
	var B = M[2][0]*Xn + M[2][1]*Yn + M[2][2]*Zn;
	var isOutsideUp = false;
	var isOutsideDown = false;
	var RGB = [R, G, B];
	for (var i = 0; i < 3; i ++){
		if (RGB[i] < 0){
			isOutsideDown = true;
			RGB[i] = 0;
		};
		if (RGB[i] > 1){
			isOutsideUp = true;
			RGB[i] = 1;
		};
		RGB[i] = gamma(RGB[i]);
	};
	this.isOutsideGamutUp = isOutsideUp;
	this.isOutsideGamutDown = isOutsideDown;
	return [RGB, isOutsideDown, isOutsideUp];
};

// http://color.org/chardata/rgb/sRGB.pdf
currentSpectrum.XYZtosRGB = function(XYZ){
	var M = [
		[3.2406255,		-1.537208,	-0.4986286],
		[-0.9689307,	1.8757561,	0.0415175],
		[0.0557101,		-0.2040211,	1.0569959]
		];
	var gamma = function(x){
		if (x <= 0.0031308){
			return (323/25)*x;
		} else {
			return (211*Math.pow(x,5/12) - 11)/200;
		};
	};
	var Xw = 76.04;
	var Yw = 80;
	var Zw = 87.12;
	var X = XYZ[0]*Yw; 
	var Y = XYZ[1]*Yw;
	var Z = XYZ[2]*Yw;
	var Xk = 0.1901;
	var Yk = 0.2;
	var Zk = 0.2178;
	var Xn = ((X - Xk)/(Xw - Xk))*(Xw/Yw);
	var Yn = ((Y - Yk)/(Yw - Yk));
	var Zn = ((Z - Zk)/(Zw - Zk))*(Zw/Yw);
	var R = M[0][0]*Xn + M[0][1]*Yn + M[0][2]*Zn;
	var G = M[1][0]*Xn + M[1][1]*Yn + M[1][2]*Zn;
	var B = M[2][0]*Xn + M[2][1]*Yn + M[2][2]*Zn;
	var isOutsideUp = false;
	var isOutsideDown = false;
	var RGB = [R, G, B];
	for (var i = 0; i < 3; i ++){
		if (RGB[i] < 0){
			isOutsideDown = true;
			RGB[i] = 0;
		};
		if (RGB[i] > 1){
			isOutsideUp = true;
			RGB[i] = 1;
		};
		RGB[i] = gamma(RGB[i]);
	};
	this.isOutsideGamutUp = isOutsideUp;
	this.isOutsideGamutDown = isOutsideDown;
	return [RGB, isOutsideDown, isOutsideUp];
};

// http://color.org/chardata/rgb/sRGB.pdf

currentSpectrum.RGBNormalize = function(RGB){
	return [
		Math.round(RGB[0]*255),
		Math.round(RGB[1]*255),
		Math.round(RGB[2]*255)
		];
};

currentSpectrum.returnRGB = function(returnNormalized){
	var XYZ = this.spectrumToXYZ();
	var RGB = this.colorSpaceConversionFunction(XYZ)[0];
	var RGBNormalized = this.RGBNormalize(RGB);
	if(returnNormalized){
		return RGBNormalized;
	} else {
		return RGB;
	};
};

currentSpectrum.setPreviewColor = function(){
	this.previewColor = this.returnRGB(false);
};

currentSpectrum.setObserver = function(observerPath){
	if (typeof(observerPath) === 'undefined'){
		observerPath = this.observerPath;
	};
	this.observer = [];
	this.observer.X = this.readSpectrumCSV(observerPath, this.observerDelimiter, 0, 1);
	this.observer.Y = this.readSpectrumCSV(observerPath, this.observerDelimiter, 0, 2);
	this.observer.Z = this.readSpectrumCSV(observerPath, this.observerDelimiter, 0, 3);
};

currentSpectrum.setIlluminant = function(illuminantPath){
	if (typeof(illuminantPath) === 'undefined'){
		illuminantPath = this.illuminantPath;
	};
	this.illuminant = this.readSpectrumCSV(illuminantPath, this.illuminantDelimiter, 0, 1);
};

currentSpectrum.setSpectrum = function(spectrumPath){
	if (typeof(spectrumPath) === 'undefined'){
		spectrumPath = this.spectrumPath;
	};
	var newSpectrum = this.readSpectrumCSV(spectrumPath, this.spectrumDelimiter, 0, 1);
	if (newSpectrum != false){
		this.spectrum = newSpectrum;
		this.spectrumPath = spectrumPath;
		this.determineSpectrumMaximum();
		this.setMaxSaturation();
		this.setPreviewColor();
		return true;
	} else {
		return false;
	};
};

currentSpectrum.findMaxSaturation = function(minSaturation, maxSaturation, i){
	lcFactor = (minSaturation + maxSaturation)/2;
	var dummyColor = this.XYZtoAdobeRGB(this.spectrumToXYZ(lcFactor));
	if (i > 0){
		if (dummyColor[1]){
			lcFactor = currentSpectrum.findMaxSaturation(minSaturation, lcFactor, i - 1);
		} else {
			lcFactor = currentSpectrum.findMaxSaturation(lcFactor, maxSaturation, i - 1);
		};
	};
	return lcFactor;
};

currentSpectrum.setMaxSaturation = function(){
	this.maxSaturation = this.findMaxSaturation(0, 100/this.spectrumMaximum, 24);
	this.lcFactor = this.maxSaturation/2;
};

var delimiters = {
		"comma":",",
		"tab":"\t"
	};

var colorSpaces = {
		"Adobe RGB (1998)":currentSpectrum.XYZtoAdobeRGB,
		"sRGB":currentSpectrum.XYZtosRGB
	};

currentSpectrum.minWL = 380;
currentSpectrum.maxWL = 780;
currentSpectrum.stepWL = 5;

currentSpectrum.isOutsideGamutUp = false;
currentSpectrum.isOutsideGamutDown = false;
currentSpectrum.spectrumDelimiter = delimiters["comma"];
currentSpectrum.illuminantDelimiter = delimiters["comma"];
currentSpectrum.observerDelimiter = delimiters["comma"];
currentSpectrum.colorSpaceConversionFunction = colorSpaces["Adobe RGB (1998)"];


// illuminant and observer data comes from here: http://files.cie.co.at/204.xls

var scriptDataPath = (new File($.fileName)).parent + "/spectrum-to-rgb_data/";
currentSpectrum.observerPath = scriptDataPath + "CIE1931observer.csv";
currentSpectrum.illuminantPath = scriptDataPath + "CIED65.csv";
currentSpectrum.spectrumPath = scriptDataPath + "grey.csv";


currentSpectrum.setObserver();
currentSpectrum.setIlluminant();
currentSpectrum.setSpectrum();
currentSpectrum.swatchName = "Sample grey";

var openSpectrumWindow = new Window("dialog", "Spectrum to RGB conversion");

var basicSettings = openSpectrumWindow.add("panel", undefined, "Choose a spectrum file");
	basicSettings.size = [380, 80];
	var spectrumFileGroup = basicSettings.add("group");
		spectrumFileGroup.orientation = "row";
	var spectrumFile = spectrumFileGroup.add("button",undefined,"Open a spectrum file");
	var spectrumFileDelimiterText = spectrumFileGroup.add("statictext", undefined, "Delimiter:");
	var spectrumFileDelimiter = spectrumFileGroup.add("dropdownlist", undefined, 
		(function(x){var keys = [];for (var key in x){keys.push(key);}return keys;})(delimiters)
		);
		spectrumFileDelimiter.selection = 0;
		spectrumFileDelimiter.onChange = function(){
			currentSpectrum.spectrumDelimiter = delimiters[spectrumFileDelimiter.selection];
			//currentSpectrum.setSpectrum();
			//colorPreview.updateAll();
		};
	var fileNameText = basicSettings.add("statictext",undefined,undefined, 
			{truncate:'middle'});
		fileNameText.text = currentSpectrum.spectrumPath;
		fileNameText.size = [350, 20];
	spectrumFile.onClick = function () {
		var file = File.openDialog();
		currentSpectrum.swatchName = file.name;  
		var spectrumSet = currentSpectrum.setSpectrum(file.fsName);
		if (spectrumSet){
			fileNameText.text = currentSpectrum.spectrumPath;
			file.close();
			colorPreview.updateAll();
			swatchName.text = currentSpectrum.swatchName;
			spectrumFilePath.text = spectrumFileName;
		};
	};
	
/*	var absorptionOrEmission = basicSettings.add("group");
		absorptionOrEmission.orientation = "row";
	var absorptionRB = absorptionOrEmission.add("radiobutton", undefined, "absorption");
	var emissionRB = absorptionOrEmission.add("radiobutton", undefined, "Emission");*/

var advancedSettings = openSpectrumWindow.add("panel", undefined, "Advanced Settings");
	advancedSettings.size = [380, 50];
	var colorSpace = advancedSettings.add("dropdownlist", undefined, 
		(function(x){var keys = [];for (var key in x){keys.push(key);}return keys;})(colorSpaces)
		);
		colorSpace.selection = 0;
		colorSpace.onChange = function(){
			currentSpectrum.colorSpaceConversionFunction = colorSpaces[colorSpace.selection];
			currentSpectrum.setMaxSaturation();
			currentSpectrum.setPreviewColor();
			colorPreview.updateAll();
		};
	/*var illuminantFileGroup = advancedSettings.add("group");
		illuminantFileGroup.orientation = "row";
	var illuminantFile = illuminantFileGroup.add("button",undefined,"Open an illuminant file");*/


var colorPreview = openSpectrumWindow.add("panel", undefined, "Color preview");
	colorPreview.size = [380, 80];
	var lcControlGroup = colorPreview.add("group");
		lcControlGroup.orientation = "row";
	var lcControl = lcControlGroup.add("slider",undefined,"Open an illuminant file");
		lcControl.minvalue = 0;
		lcControl.maxvalue = 1;
		lcControl.value = currentSpectrum.lcFactor/currentSpectrum.maxSaturation;
	lcControl.onChanging = function() {
	    lcControlValue.text = lcControl.value*currentSpectrum.maxSaturation;
	    currentSpectrum.lcFactor = Number(lcControlValue.text);
		currentSpectrum.setPreviewColor();
	    lcColorPreview.hide();
		lcColorPreview.show();
	    };
	var lcControlUnit = lcControlGroup.add("statictext", undefined, "lc = ");
	var lcControlValue = lcControlGroup.add("edittext", [0,0,110,20], lcControl.value*currentSpectrum.maxSaturation);
	lcControlValue.onChange = function() {
	    lcControl.value = Number(lcControlValue.text)/currentSpectrum.maxSaturation;
	    currentSpectrum.lcFactor = Number(lcControlValue.text);
		currentSpectrum.setPreviewColor();
	    lcColorPreview.hide();
		lcColorPreview.show();
	    };
	var lcColorPreview = lcControlGroup.add("group");
		lcColorPreview.size = [50, 50];
	var colorPreview = lcColorPreview.graphics;
		lcColorPreview.onDraw = function() {
			colorPreview.newPath();
			colorPreview.rectPath(0, 0, 50, 50);
			colorPreview.fillPath(
				colorPreview.newBrush(
					colorPreview.BrushType.SOLID_COLOR, currentSpectrum.previewColor));
			colorPreview.closePath();
		};
	colorPreview.updateAll = function(){
		lcControl.value = currentSpectrum.lcFactor/currentSpectrum.maxSaturation;
		lcControlValue.text = currentSpectrum.lcFactor;
		lcColorPreview.hide();
		lcColorPreview.show();
	};
		

var swatchNameGroup = openSpectrumWindow.add("group");
	swatchNameGroup.orientation = "row";
	var swatchNameText = swatchNameGroup.add("statictext", undefined, "Swatch name:");
	var swatchName = swatchNameGroup.add("edittext", undefined, currentSpectrum.swatchName);
		swatchName.preferredSize.width = 250;
		swatchName.onChange = function() {
			currentSpectrum.swatchName = swatchName.text;
		};

var completeControlGroup = openSpectrumWindow.add("group");
	completeControlGroup.orientation = "row";

	var createSwatch = false;
	var okButton = completeControlGroup.add("button",undefined,"Create a swatch");

	okButton.onClick = function () {
		createSwatch = true;
		openSpectrumWindow.close();
	};

	var cancelButton = completeControlGroup.add("button",undefined,"Cancel");

	cancelButton.onClick = function () {
		createSwatch = false;
		openSpectrumWindow.close();
	};

openSpectrumWindow.show();

if (createSwatch){
	if (app.name === "Adobe InDesign"){
		if (app.documents[0].colors.itemByName(currentSpectrum.swatchName).isValid){
			app.documents[0].colors.itemByName(currentSpectrum.swatchName).remove();
		};
		var newColor = app.activeDocument.colors.add();
		newColor.space = ColorSpace.RGB;
		newColor.name = currentSpectrum.swatchName;
		newColor.colorValue = currentSpectrum.returnRGB(true);
	};

	if (app.name === "Adobe Illustrator"){
		var RGBValues = currentSpectrum.returnRGB(true);
		var newColor = new RGBColor();
		newColor.red = RGBValues[0];
		newColor.green = RGBValues[1];
		newColor.blue = RGBValues[2];
		var newSwatch = app.activeDocument.swatches.add();
		newSwatch.name = currentSpectrum.swatchName;
		newSwatch.color = newColor;
	};

	if (app.name === "Adobe Photoshop"){
		alert(currentSpectrum.returnRGB(true));
	};
};
