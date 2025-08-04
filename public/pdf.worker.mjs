
"use strict";

var pdfjsLib;

if (typeof window !== "undefined" && window["pdfjs-dist/build/pdf"]) {
  pdfjsLib = window["pdfjs-dist/build/pdf"];
} else {
  pdfjsLib = require("pdfjs-dist/build/pdf.js");
}

module.exports = pdfjsLib;
