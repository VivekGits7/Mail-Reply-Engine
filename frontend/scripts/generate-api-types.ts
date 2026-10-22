import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface JsonSchema {
  $ref?: string;
  type?: string | string[];
  enum?: (string | number)[];
  items?: JsonSchema;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  const?: string | number | boolean;
}

interface OpenApiSpec {
  components: { schemas: Record<string, JsonSchema> };
}

const SKIPPED = /^(Body_|.*ErrorResponse$|BadRequestResponse$|UnauthorizedResponse$|ForbiddenResponse$|NotFoundResponse$|ConflictResponse$|GoneResponse$|RateLimitResponse$|BadGatewayResponse$|ServiceUnavailableResponse$|ValidationErrorResponse$|ErrorBody$|ErrorDetail$)/;

const source = process.argv[2] ?? 'http://localhost:8000/openapi.json';
const target = resolve(import.meta.dirname, '../src/types/schema.ts');

async function loadSpec(): Promise<OpenApiSpec> {
  if (/^https?:/.test(source)) {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`Could not fetch ${source}: ${response.status}`);
    return (await response.json()) as OpenApiSpec;
  }
  return JSON.parse(readFileSync(source, 'utf8')) as OpenApiSpec;
}

function constKey(value: string | number): string {
  const key = String(value)
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .toUpperCase();
  return /^[0-9]/.test(key) ? `V_${key}` : key;
}

function literal(value: string | number | boolean): string {
  return typeof value === 'string' ? `'${value.replace(/'/g, "\\'")}'` : String(value);
}

function typeOf(schema: JsonSchema | undefined): string {
  if (!schema) return 'unknown';
  if (schema.$ref) return schema.$ref.split('/').pop()!;
  if (schema.const !== undefined) return literal(schema.const);
  if (schema.enum) return schema.enum.map(literal).join(' | ');
  const union = schema.anyOf ?? schema.oneOf;
  if (union) return [...new Set(union.map(typeOf))].join(' | ');
  if (schema.allOf?.length === 1) return typeOf(schema.allOf[0]);
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  switch (type) {
    case 'string':
      return 'string';
    case 'integer':
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'null':
      return 'null';
    case 'array':
      return `${wrap(typeOf(schema.items))}[]`;
    case 'object':
      if (schema.properties) return inlineObject(schema);
      if (schema.additionalProperties && typeof schema.additionalProperties === 'object')
        return `Record<string, ${typeOf(schema.additionalProperties)}>`;
      return 'Record<string, unknown>';
    default:
      return 'unknown';
  }
}

function wrap(type: string): string {
  return type.includes(' | ') ? `(${type})` : type;
}

function fields(schema: JsonSchema, indent: string): string {
  const required = new Set(schema.required ?? []);
  return Object.entries(schema.properties ?? {})
    .map(([name, prop]) => `${indent}${name}${required.has(name) ? '' : '?'}: ${typeOf(prop)};`)
    .join('\n');
}

function inlineObject(schema: JsonSchema): string {
  return `{\n${fields(schema, '    ')}\n  }`;
}

function render(name: string, schema: JsonSchema): string {
  if (schema.enum) {
    const members = schema.enum.map((value) => `  ${constKey(value)}: ${literal(value)},`).join('\n');
    return `export const ${name} = {\n${members}\n} as const;\nexport type ${name} = (typeof ${name})[keyof typeof ${name}];`;
  }
  if (schema.properties) return `export interface ${name} {\n${fields(schema, '  ')}\n}`;
  return `export type ${name} = ${typeOf(schema)};`;
}

const spec = await loadSpec();
const blocks = Object.entries(spec.components.schemas)
  .filter(([name]) => !SKIPPED.test(name))
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, schema]) => render(name, schema));

const header = '// Generated from the backend OpenAPI spec by scripts/generate-api-types.ts. Run `bun run gen:types` instead of editing.';
writeFileSync(target, `${header}\n\n${blocks.join('\n\n')}\n`);
console.log(`Wrote ${blocks.length} types to ${target}`);
