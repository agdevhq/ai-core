import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineTool } from './tool.ts';

describe('defineTool', () => {
    it('should create a tool definition from a Zod schema', () => {
        const tool = defineTool({
            name: 'search',
            description: 'Search the web',
            parameters: z.object({
                query: z.string().describe('The search query'),
            }),
        });

        expect(tool.name).toBe('search');
        expect(tool.description).toBe('Search the web');
        expect(tool.parameters).toBeDefined();
    });
});
