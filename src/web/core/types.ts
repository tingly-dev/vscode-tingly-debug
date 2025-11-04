// Data models and type definitions for the Debug Configurations extension

export interface LaunchConfiguration {
    name: string;
    type: string;
    request: string;
    [key: string]: any;
}

export interface LaunchCompound {
    name: string;
    configurations: string[];
    [key: string]: any;
}

export interface LaunchJson {
    version: string;
    configurations: LaunchConfiguration[];
    compounds?: LaunchCompound[];
}

export type ClickBehavior = 'openSettings' | 'none';

export interface ConfigurationData {
    name: string;
    type: string;
    request: string;
    properties: Record<string, any>;
}