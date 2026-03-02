import {Liquid} from 'liquidjs';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

type TTemplateService = {
    readonly renderSystemPrompt: (vars: {
        readonly page_tool_types: string;
        readonly page_variable_types: string;
    }) => Promise<string>;
};

const createTemplateService = (): TTemplateService => {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const templatePath = join(__dirname, '../engine/system-prompt.liquid');
    const templateContent = readFileSync(templatePath, 'utf-8');
    const engine = new Liquid();
    const template = engine.parse(templateContent);

    return Object.freeze({
        renderSystemPrompt: async (vars) => engine.render(template, vars),
    });
};

export {createTemplateService};
export type {TTemplateService};
