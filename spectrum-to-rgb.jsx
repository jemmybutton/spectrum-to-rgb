//    spectrum-to-rgb.jsx 0.0.2
//    Illustrator/InDesign script to create swatches from absorption spectra
//    Copyright 2023 Sergey Slyusarev
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

#targetengine 'session'; // palette doesn't work without this

(function(){

	//
	// Current spectrum
	//

	var currentSpectrum = {};

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

	currentSpectrum.determineSpectrumLum = function(){
		this.spectrumLum = (function(spect,obs){
			var rv = 0;
			for (var i in spect){
				rv = rv + spect[i]*obs.Y[i];
			};
			return rv;
		})(this.spectrum,this.observer);
	};

	currentSpectrum.spectrumToXYZabsorption = function(lcFactor){
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

	currentSpectrum.spectrumToXYZemission = function(lcFactor){
		if (typeof lcFactor === 'undefined'){
			lcFactor = this.lcFactor;
		};
		var N = 0;
		var X = 0;
		var Y = 0;
		var Z = 0;
		for (var i in this.spectrum){
			var emission = this.emissionNormalize(this.spectrum[i], lcFactor);
			X = X + this.observer.X[i]*emission;
			Y = Y + this.observer.Y[i]*emission;
			Z = Z + this.observer.Z[i]*emission;
		};
		return [X, Y, Z];
	};

	currentSpectrum.absorbanceToTransmittance = function(absorbance, lc){
		return Math.pow(10,-(absorbance*lc));
	};

	currentSpectrum.emissionNormalize = function(emission,lc){
		return emission*lc;
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

	currentSpectrum.RGBNormalize = function(RGB, round){
		var RGBarray = [
				RGB[0]*255,
				RGB[1]*255,
				RGB[2]*255
			];
		if (round) {
			RGBarray = [
				Math.round(RGBarray[0]),
				Math.round(RGBarray[1]),
				Math.round(RGBarray[2])]
			};
		return RGBarray;
	};

	currentSpectrum.RGBcolorString = function(RGB){
		return(
			"R: " + RGB[0] + ", " +
			"G: " + RGB[1] + ", " +
			"B: " + RGB[2]
			);
	};

	currentSpectrum.RGBdistance = function(RGBa, RGBb){
		var RGBdist = Math.pow(
			(Math.pow((RGBa[0]-RGBb[0]), 2) +
			Math.pow((RGBa[1]-RGBb[1]), 2) +
			Math.pow((RGBa[2]-RGBb[2]), 2)),
			1/2);
		return Math.round(RGBdist*100)/100;
	};

	currentSpectrum.returnRGB = function(returnNormalized){
		var XYZ = this.spectrumTypeFunction();
		var RGB = this.colorSpaceConversionFunction(XYZ)[0];
		var RGBNormalized = this.RGBNormalize(RGB, true);
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
			observerPath = standardObservers[this.standardObserver];
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
			this.determineSpectrumLum();
			this.setMaxSaturation();
			this.setPreviewColor();
			return true;
		} else {
			return false;
		};
	};

	currentSpectrum.findMaxSaturation = function(minSaturation, maxSaturation, i){
		lcFactor = (minSaturation + maxSaturation)/2;
		var dummyColor = this.colorSpaceConversionFunction(this.spectrumTypeFunction(lcFactor));
		if (currentSpectrum.spectrumType == "Absorption"){
			var criterion = 1;
		} else if (currentSpectrum.spectrumType == "Emission"){
			var criterion = 2;
		};
		if (i > 0){
			if (dummyColor[criterion]){
				lcFactor = currentSpectrum.findMaxSaturation(minSaturation, lcFactor, i - 1);
			} else {
				lcFactor = currentSpectrum.findMaxSaturation(lcFactor, maxSaturation, i - 1);
			};
		};
		return lcFactor;
	};

	currentSpectrum.setMaxSaturation = function(){
		if (currentSpectrum.spectrumType == "Absorption"){
			this.maxSaturation = this.findMaxSaturation(0, 1000/this.spectrumLum, 64);
		};
		if (currentSpectrum.spectrumType == "Emission"){
			this.maxSaturation = this.findMaxSaturation(0, this.spectrumLum, 64);
		};
		this.lcFactor = this.maxSaturation/2;
	};

	var delimiters = {
			"comma":",",
			"tab":"\t"
		};

	var spectrumTypes = {
			"Absorption":currentSpectrum.spectrumToXYZabsorption,
			"Emission":currentSpectrum.spectrumToXYZemission
		};

	var spectrumTypeFactors = {
			"Absorption":"lc = ",
			"Emission":"f = "
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
	currentSpectrum.spectrumType = "Absorption";
	currentSpectrum.spectrumTypeFunction = spectrumTypes[currentSpectrum.spectrumType];
	currentSpectrum.spectrumTypeFactor = spectrumTypeFactors[currentSpectrum.spectrumType];
	currentSpectrum.colorSpaceConversionFunction = colorSpaces["Adobe RGB (1998)"];


	// illuminant and observer data comes from here: http://files.cie.co.at/204.xls

	var scriptDataPath = (new File($.fileName)).parent + "/spectrum-to-rgb_data/";
	var standardObservers = {
			"CIE 1931":scriptDataPath + "CIE1931observer.csv"
			//,"CIE 1964":scriptDataPath + "CIE1964observer.csv"
		};
	currentSpectrum.standardObserver = "CIE 1931";
	currentSpectrum.illuminantPath = scriptDataPath + "CIED65.csv";
	currentSpectrum.spectrumPath = scriptDataPath + "grey.csv";


	currentSpectrum.setObserver();
	currentSpectrum.setIlluminant();
	currentSpectrum.setSpectrum();
	currentSpectrum.swatchName = "Sample grey";

	var openSpectrumWindow = new Window("palette", "Spectrum to RGB conversion");

	var basicSettings = openSpectrumWindow.add("panel", undefined, "Choose a spectrum file");
		basicSettings.size = [700, 80];
		var spectrumFileGroup = basicSettings.add("group");
			spectrumFileGroup.orientation = "row";
			spectrumFileGroup.alignment ="left";
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
		var spectrumTypeText = spectrumFileGroup.add("statictext", undefined, "Spectrum type:");
		var spectrumType = spectrumFileGroup.add("dropdownlist", undefined, 
			(function(x){var keys = [];for (var key in x){keys.push(key);}return keys;})(spectrumTypes)
			);
			spectrumType.selection = 0;
			spectrumType.onChange = function(){
				currentSpectrum.spectrumType = spectrumType.selection.text;
				currentSpectrum.spectrumTypeFactor = spectrumTypeFactors[spectrumType.selection];
				lcControlUnit.text = currentSpectrum.spectrumTypeFactor;
				currentSpectrum.spectrumTypeFunction = spectrumTypes[spectrumType.selection];
				currentSpectrum.setMaxSaturation();
				currentSpectrum.setPreviewColor();
				colorPreview.updateAll();
			};

		var fileNameText = basicSettings.add("statictext",undefined,undefined, 
				{truncate:'middle'});
			fileNameText.text = currentSpectrum.spectrumPath;
			fileNameText.size = [700, 20];
		fileNameText.alignment ="left";
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
		

	var advancedSettings = openSpectrumWindow.add("panel", undefined, "Advanced Settings");
		advancedSettings.size = [700, 50];
		advancedSettings.alignChildren ="left";
		var advancedSettingsGroup = advancedSettings.add("group");
			advancedSettingsGroup.orientation = "row";
			var colorSpace = advancedSettingsGroup.add("dropdownlist", undefined, 
				(function(x){var keys = [];for (var key in x){keys.push(key);}return keys;})(colorSpaces)
				);
				colorSpace.selection = 0;
				colorSpace.onChange = function(){
					currentSpectrum.colorSpaceConversionFunction = colorSpaces[colorSpace.selection];
					currentSpectrum.setMaxSaturation();
					currentSpectrum.setPreviewColor();
					colorPreview.updateAll();
				};
			if(standardObservers.length > 1){
				var standardObserver = advancedSettingsGroup.add("dropdownlist", undefined, 
					(function(x){var keys = [];for (var key in x){keys.push(key);}return keys;})(standardObservers)
					);
					standardObserver.selection = 0;
					standardObserver.onChange = function(){
						currentSpectrum.standardObserver = standardObserver.selection;
						currentSpectrum.setObserver();
						currentSpectrum.setMaxSaturation();
						currentSpectrum.setPreviewColor();
						colorPreview.updateAll();
				};
			};
		/*var illuminantFileGroup = advancedSettings.add("group");
			illuminantFileGroup.orientation = "row";
		var illuminantFile = illuminantFileGroup.add("button",undefined,"Open an illuminant file");*/

	var colorPreview = openSpectrumWindow.add("panel", undefined, "Color preview");
		colorPreview.size = [700, 120];
		colorPreview.alignChildren ="left";
		var lcControlGroup = colorPreview.add("group");
			lcControlGroup.orientation = "row";
		var rgbValuesPreview = colorPreview.add("group");
		var rgbText = rgbValuesPreview.add("statictext", undefined, "");
		rgbText.characters = 14;
		rgbText.text = currentSpectrum.RGBcolorString(currentSpectrum.RGBNormalize(currentSpectrum.previewColor, true));

		var rgbDistanceLabel = rgbValuesPreview.add("statictext", undefined, "RGB distance: ");
		var rgbDistanceText = rgbValuesPreview.add("statictext", undefined, "");
		rgbDistanceText.characters = 10;
		rgbDistanceText.text = currentSpectrum.RGBdistance(
			currentSpectrum.RGBNormalize(currentSpectrum.previewColor, true),
			currentSpectrum.RGBNormalize(currentSpectrum.previewColor, false)
			);
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
			if (currentSpectrum.spectrumType == "Absorption"){
				lcControlValue.text = currentSpectrum.lcFactor;
			} else if (currentSpectrum.spectrumType == "Emission"){
				lcControlValue.text = Math.round(lcControl.value*1000)/1000;
			};
			lcColorPreview.hide();
			lcColorPreview.show();
			rgbText.text = currentSpectrum.RGBcolorString(currentSpectrum.RGBNormalize(currentSpectrum.previewColor, true));
			rgbDistanceText.text = currentSpectrum.RGBdistance(
				currentSpectrum.RGBNormalize(currentSpectrum.previewColor, true),
				currentSpectrum.RGBNormalize(currentSpectrum.previewColor, false)
				);
		};
		var lcControl = lcControlGroup.add("slider",undefined,"Open an illuminant file");
			lcControl.minvalue = 0;
			lcControl.maxvalue = 1;
			lcControl.value = currentSpectrum.lcFactor/currentSpectrum.maxSaturation;
			lcControl.size = [450,10];
		lcControl.onChanging = function() {
		    currentSpectrum.lcFactor = Number(lcControl.value*currentSpectrum.maxSaturation);
			currentSpectrum.setPreviewColor();
		    colorPreview.updateAll();
		    };
		var lcControlUnit = lcControlGroup.add("statictext", undefined, currentSpectrum.spectrumTypeFactor);
		var lcControlValue = lcControlGroup.add("edittext", [0,0,110,20], lcControl.value*currentSpectrum.maxSaturation);
		lcControlValue.onChange = function() {
		    currentSpectrum.lcFactor = Number(lcControlValue.text);
			currentSpectrum.setPreviewColor();
		    colorPreview.updateAll();
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
				var bridgeTalkObject = new BridgeTalk;
				bridgeTalkObject.target = "illustrator";
				bridgeTalkObject.body = ""
				+ "var newColor = new RGBColor();"
				+ "newColor.red = "  +  RGBValues[0] + ";"
				+ "newColor.green = " + RGBValues[1] + ";"
				+ "newColor.blue = " + RGBValues[2] + ";"
				+ "var newSwatch = app.activeDocument.swatches.add();"
				+ "newSwatch.name = \"" + currentSpectrum.swatchName + "\";"
				+ "newSwatch.color = newColor;";
				bridgeTalkObject.send();
			};

			if (app.name === "Adobe Photoshop"){
				alert(currentSpectrum.returnRGB(true));
			};

		};

		var cancelButton = completeControlGroup.add("button",undefined,"Cancel");

		cancelButton.onClick = function () {
			openSpectrumWindow.close();
		};

	openSpectrumWindow.show();

})();