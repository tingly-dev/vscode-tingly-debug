# Change Log

All notable changes to the "Tingly Debug" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.1.0] - 2025-11-05

### Changed
- ✅ Updated command IDs for better consistency and organization
- ✅ Improved error handling when creating debug configurations from symbols
- ✅ Enhanced error notifications with channel output for better debugging

## [0.0.5] - 2025-11-05

### Added
- ✅ Single unified page for switching between different debug configurations
- ✅ Improved webview data initialization for better configuration page management

### Changed
- ✅ Better project structure with code separation into config/, core/, util/, and views/ directories
- ✅ Extracted long HTML template for improved maintainability
- ✅ Made configuration page unique to avoid UI inconsistencies
- ✅ Enhanced code organization and modularity

### Refactored
- ✅ Separated configuration generation and debug command generation logic
- ✅ Improved command handlers structure
- ✅ Better type definitions and organization

## [0.0.2] - 2025-11-04

### Added
- ✅ Support creating debug configurations from symbols with test suite integration (e.g., pytest for Python)
- ✅ New command to generate debug configurations from test symbols

### Fixed
- ✅ Bugfix: resolved sync errors and JSONC parse errors in launch.json handling
- ✅ Improved error handling for configuration synchronization

### Changed
- ✅ Refactored code to improve modularity and maintainability
- ✅ Removed duplicate run commands since debug commands provide the same functionality for configuration
- ✅ Optimized launch.json loading to process `configuration` section only
- ✅ Enhanced UI strings for better user experience 

## [0.0.1]

First release with core features for run/debug configuration and management.

- ✅ Configuration tree view with icons
- ✅ Launch.json synchronization
- ✅ Add, edit, delete, duplicate operations
- ✅ Run and debug functionality
- ✅ Compound configuration support
- ✅ Visual configuration editor
- ✅ Quick configuration from files

## [Unreleased]
