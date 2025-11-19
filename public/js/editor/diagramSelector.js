import {h} from 'https://esm.sh/preact';
import htm from 'https://esm.sh/htm';
import {getSampleDiagrams} from '/js/mermaid.js';

const html = htm.bind(h);

export function DiagramSelector({onSelectDiagram, onCancel}) {
  
  const getDiagramSamples = () => {
    try {
      const sampleDiagrams = getSampleDiagrams();
      const diagramOrder = [
        { key: 'Flowchart', name: 'Flowchart' },
        { key: 'Class', name: 'Class' },
        { key: 'Sequence', name: 'Sequence' },
        { key: 'State', name: 'State' },
        { key: 'Architecture', name: 'Architecture' },
        { key: 'Block', name: 'Block' },
        { key: 'C4', name: 'C4' },
        { key: 'ER', name: 'ER' },
        { key: 'Gantt', name: 'Gantt' },
        { key: 'Git', name: 'Git' },
        { key: 'Kanban', name: 'Kanban' },
        { key: 'Mindmap', name: 'Mindmap' },
        { key: 'Packet', name: 'Packet' },
        { key: 'Pie', name: 'Pie' },
        { key: 'Quadrant', name: 'Quadrant' },
        { key: 'Requirement', name: 'Requirement' },
        { key: 'Sankey', name: 'Sankey' },
        { key: 'Timeline', name: 'Timeline' },
        { key: 'User Journey', name: 'User Journey' },
        { key: 'XY', name: 'XY' }
      ];
      
      return diagramOrder
        .filter(item => sampleDiagrams[item.key])
        .map(item => ({
          id: item.key.toLowerCase().replace(/\s+/g, ''),
          name: item.name,
          code: sampleDiagrams[item.key]
        }));
        
    } catch (error) {
      console.error('Error loading diagram samples:', error);
      return [];
    }
  };

  const diagramSamples = getDiagramSamples();

  const onDiagramClick = (diagram) => {
    onSelectDiagram(diagram);
  };

  const onCloseClick = () => {
    onCancel();
  };

  const onStartBlankClick = () => {
    onSelectDiagram({
      id: 'blank',
      name: 'Blank Diagram',
      code: ''
    });
  };

  return html`
    <div class="diagram-selector-page">
      <div class="diagram-selector-content">
        <div class="diagram-selector-header">
          <h3>Choose from one of our sample diagrams.</h3>
          <button class="close-button" onClick=${onCloseClick}>×</button>
        </div>
        
        <div class="diagram-samples-grid">
          ${diagramSamples.map(diagram => html`
            <button class="diagram-sample-item" onClick=${() => onDiagramClick(diagram)}>
              <div class="diagram-sample-name">${diagram.name}</div>
              <div class="diagram-sample-icon">
               <svg width="22" height="18" viewBox="0 0 22 18" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M2 18C1.45 18 0.979166 17.8042 0.5875 17.4125C0.195833 17.0208 0 16.55 0 16V2C0 1.45 0.195833 0.979167 0.5875 0.5875C0.979166 0.195833 1.45 0 2 0H20C20.55 0 21.0208 0.195833 21.4125 0.5875C21.8042 0.979167 22 1.45 22 2V16C22 16.55 21.8042 17.0208 21.4125 17.4125C21.0208 17.8042 20.55 18 20 18H2ZM2 16H20V4H2V16ZM15.675 10L13.775 8.1C13.575 7.9 13.4792 7.66667 13.4875 7.4C13.4958 7.13333 13.6 6.9 13.8 6.7C14 6.51667 14.2333 6.42083 14.5 6.4125C14.7667 6.40417 15 6.5 15.2 6.7L17.8 9.3C18 9.5 18.1 9.73333 18.1 10C18.1 10.2667 18 10.5 17.8 10.7L15.2 13.3C15.0167 13.4833 14.7875 13.5792 14.5125 13.5875C14.2375 13.5958 14 13.5 13.8 13.3C13.6167 13.1167 13.525 12.8833 13.525 12.6C13.525 12.3167 13.6167 12.0833 13.8 11.9L15.675 10ZM5 11C4.71667 11 4.47917 10.9042 4.2875 10.7125C4.09583 10.5208 4 10.2833 4 10C4 9.71667 4.09583 9.47917 4.2875 9.2875C4.47917 9.09583 4.71667 9 5 9H7C7.28333 9 7.52083 9.09583 7.7125 9.2875C7.90417 9.47917 8 9.71667 8 10C8 10.2833 7.90417 10.5208 7.7125 10.7125C7.52083 10.9042 7.28333 11 7 11H5Z" fill="#396F81"/>
<path d="M10 11C9.71667 11 9.47917 10.9042 9.2875 10.7125C9.09583 10.5208 9 10.2833 9 10C9 9.71667 9.09583 9.47917 9.2875 9.2875C9.47917 9.09583 9.71667 9 10 9H12C12.2833 9 12.5208 9.09583 12.7125 9.2875C12.9042 9.47917 13 9.71667 13 10C13 10.2833 12.9042 10.5208 12.7125 10.7125C12.5208 10.9042 12.2833 11 12 11H10Z" fill="#396F81"/>
</svg>
   </div>
            </button>
          `)}
        </div>
        
        <div class="create-own-section px-[32px]">
          <button class="text-center w-full p-[16px] emptyTemplate" onClick=${onStartBlankClick}>
            <div class="text-[#ffffff] own-diagram-btn">Start with your own Diagram</div>
          </button>
        </div>
      </div>
    </div>
  `;
}
