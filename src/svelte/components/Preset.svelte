<script>
  import Card from './Card.svelte';
  import { getSampleDiagrams } from '../utils/mermaid.js';
  import ShapesIcon from '~icons/material-symbols/account-tree-outline';

  export let onLoadSample = () => {};
  export let isOpen = true; 

  const samples = { ...getSampleDiagrams()};
  
  const loadSampleDiagram = (diagramType) => {
    const sampleCode = samples[diagramType];
    if (sampleCode) {
      onLoadSample(sampleCode);
    }
  };

  const mainDiagrams = [
    'Flowchart',
    'Class',
    'Sequence',
    'Entity Relationship',
    'State',
    'Mindmap'
  ];

  const diagramOrder = [
    ...mainDiagrams,
    ...Object.keys(samples)
      .filter((key) => !mainDiagrams.includes(key))
      .sort()
  ];
</script>

<Card title="Sample diagrams" {isOpen} isStackable={true} icon={ShapesIcon}>
  <div class="flex  max-h-52 flex-wrap gap-[12px] overflow-y-auto p-[16px]">
    {#each diagramOrder as sample}
      <button
        class="rounded-md px-[12px] py-[6px] bg-[#F1F8FA] hover:bg-[#DCEEF1] rounded-[8px] border-none text-xs w-fit min-w-20 flex-grow normal-case"
         style="font-family: 'Recursive'"
        on:click={() => loadSampleDiagram(sample)}
      >
        {sample}
      </button>
    {/each}
  </div>
</Card>

<style>
  button {
    background: #F1F8FA;
    color: #334155;
    font-weight: 500;
    transition: all 0.2s;
  }
</style>
