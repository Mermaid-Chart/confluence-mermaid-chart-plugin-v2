import {h} from 'https://esm.sh/preact';
import htm from 'https://esm.sh/htm';
import {useEffect} from 'https://esm.sh/preact/hooks';

const html = htm.bind(h);

export function Diagram({document, onOpenFrame, mcAccessToken}) {
    let image = '';
    if (document.documentID) {
        image = html`
            <div class="image">
                <img src="data:image/x-png;base64, ${document.diagramImage}" alt="${document.title}"/>
            </div>`;
    }

    const buildUrl = (pathname) => {
        return `${MC_BASE_URL}/oauth/frame/?token=${mcAccessToken}&redirect=${pathname}`;
    };

    const onEdit = () => {
        onOpenFrame(buildUrl(
            `/app/projects/${document.projectID}/diagrams/${document.documentID}/version/v${document.major}.${document.minor}/edit`));
        return false;
    };

    const onSelect = () => {
        onOpenFrame(buildUrl(
            `/app/plugins/confluence/select`))
        return false;
    };

    useEffect(() => {
        if (!document.documentID) {
            onSelect();
        }
    }, [document])

    return html`
        <div id="diagram-container">
            <div class="diagram">
                ${image}
            </div>
            <div class="select-buttons">
                <button type="button" onClick="${onEdit}">Edit current diagram</button>
                <button type="button" onClick="${onSelect}">
                    Select different diagram
                </button>
            </div>
        </div>
    `;
}
