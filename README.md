OpenSCAD.net
============

**This project is a work in progress!** Check the list of missing features and the github issues page to see what will not work.

## Introduction
OpenSCAD.net is a partial port of [OpenSCAD](http://www.openscad.org/) for the web. Powered by [OpenJsCad](http://joostn.github.com/OpenJsCad/), it uses the familiar OpenSCAD syntax to allow many OpenSCAD models to be rendered, and saved as STL, via the browser.

## Basics Usage

Paste or type an OpenSCAD script into the editor and hit F4 (or select "Reload and Compile" from the Design menu). The model should render in the panel to the right. Any error messages should appear in the log panel at the bottom, or in the browser console.

### Imported Libraries via Dropbox

So that scripts can utilise the "use" and "include" directives, the application can connect to a Dropbox account in order to import library files stored there. Authorising access for the app will create a dedicated, sandboxed, folder in your Dropbox space. Folders and files stored here can be referenced via "use" and "include" statements. Scripts can also be saved to the Dropbox space, via the Save option.

## Missing Features

Several features are either not yet implemented or can/will not be implemented. For this reason many of the original OpenSCAD examples, which are available through the File/Examples menu, will not work. These are marked as such with a strikethrough.

* DXF import and manipulation (e.g. import_dxf, dxf-cross, dxf_dim functions).
* STL import.
* rotate_extrude.
* minkowski and hull transformations.
* $fa, $fs global variables.
* Modifier characters: #, !, %).

## Development

Lexing and Parsing is done via the node module: [jison](http://zaach.github.com/jison/).  Modify *openscad-parser.jison* and compile it to javascript with `jison openscad-parser.jison`.  

To run the parser from node you have to uncomment the three require statements around line 595 (I have yet to work out how to make it happy in the browser and node).  This allows you to use *testharness.js* which will parse the contents of *test.scad*.