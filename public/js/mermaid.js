import { diagramData } from 'https://esm.sh/@mermaid-js/examples';
import elkLayouts from 'https://esm.sh/@mermaid-js/layout-elk';
import zenuml from 'https://esm.sh/@mermaid-js/mermaid-zenuml';
import mermaid from 'https://esm.sh/mermaid';

mermaid.registerLayoutLoaders(elkLayouts);
const init = mermaid.registerExternalDiagrams([zenuml]);

export const render = async (config, code, id) => {
  await init;
  mermaid.initialize(config);
  return await mermaid.render(id, code);
};

export const parse = async (code) => {
  return await mermaid.parse(code);
};

export const standardizeDiagramType = (diagramType) => {
  switch (diagramType) {
    case 'class':
    case 'classDiagram': {
      return 'classDiagram';
    }
    case 'graph':
    case 'flowchart':
    case 'flowchart-elk':
    case 'flowchart-v2': {
      return 'flowchart';
    }
    default: {
      return diagramType;
    }
  }
};

const isValidDiagram = (diagram) => {
  return Boolean(diagram.name && diagram.examples && diagram.examples.length > 0);
};

export const getSampleDiagrams = () => {
  const diagrams = diagramData
    .filter((d) => isValidDiagram(d))
    .map(({ examples, ...rest }) => ({
      ...rest,
      example: examples?.filter(({ isDefault }) => isDefault)[0]
    }));
  const examples = {};
  for (const diagram of diagrams) {
    examples[diagram.name.replace(/ (Diagram|Chart|Graph)/, '')] = diagram.example.code;
  }
  return examples;
};
