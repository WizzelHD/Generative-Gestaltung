function setup() {
	const numberOfLayers = 4; // Anzahl der übereinander gelegten Ebenen
	const gridSize = 3; // Pixel-Raster: höher = schneller, niedriger = feiner

	createCanvas(window.innerWidth-200, window.innerHeight-200);
	colorMode(HSB, 360, 100, 100, 255); // Hue: 0-360, Saturation: 0-100, Brightness: 0-100, Alpha: 0-255

	for (let currentLayer = 0; currentLayer < numberOfLayers; currentLayer++) {

		const layerGraphics = createGraphics(width, height);
		layerGraphics.pixelDensity(1);
		layerGraphics.colorMode(HSB, 360, 100, 100, 255); // HSB-Modus für layer
		layerGraphics.noStroke(); // Keine Rahmen um die Rechtecke

		const noiseScale = 0.004 + currentLayer * 0.0015; // Wie "gezoomt" das Noise-Muster ist (kleiner = größere Strukturen), kleiner = pixel sehen schärfer aus
		const transparency = random(100, 220) + currentLayer * 30 / numberOfLayers / 2; // Transparenz der Farben (aka alpha)
		const baseHue = random(360); // Basis-Farbton (zufälliger Startpunkt auf dem Farbkreis)
		const noiseOffset = currentLayer * 100; // offset pro Layer (für den Unterschied)
		for (let yPos = 0; yPos < layerGraphics.height; yPos += gridSize) {
			for (let xPos = 0; xPos < layerGraphics.width; xPos += gridSize) {

				const noiseX = xPos * noiseScale + noiseOffset;
				const noiseY = yPos * noiseScale + noiseOffset;

				const noiseValue = noise(noiseX, noiseY); // wert zwischen 0 und 1.0

				// Farbe aus Noise-Wert berechnen
				const hue = (baseHue + noiseValue * 120) % 360; // Farbton: 0-360° 
				const saturation = noiseValue * 100; // Sättigung: 0-100
				const brightness = noiseValue * 100; // Helligkeit: 0-100

				layerGraphics.fill(hue, saturation, brightness, transparency);
				layerGraphics.rect(xPos, yPos, gridSize, gridSize);
			}
		}
		const blendModes = [BLEND, ADD, SCREEN, MULTIPLY]; // Blend-Modi für die Ebenen: BLEND: standardmäßiges Überblenden, ADD: Farben werden addiert (heller), SCREEN: helleres Ergebnis, MULTIPLY: dunkleres Ergebnis
		blendMode(blendModes[currentLayer % blendModes.length]); 
		image(layerGraphics, 0, 0, width, height);
	}
}
