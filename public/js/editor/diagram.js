import {h} from 'https://esm.sh/preact';
import htm from 'https://esm.sh/htm';
import {useEffect, useState} from 'https://esm.sh/preact/hooks';

const html = htm.bind(h);

export function Diagram({document, onOpenFrame, mcAccessToken}) {
    const [imgSrc, setImgSrc] = useState('');
    const [error, setError] = useState(false);

    useEffect(() => {
        if (document.documentID) {
            const imageUrl = `${MC_BASE_URL}/raw/${document.documentID}?version=v${document.major}.${document.minor}&theme=light&format=png`;
            setImgSrc(imageUrl);
        }
    }, [document.documentID, document.major, document.minor]);

    let image = '';
    if (document.documentID) {
        image = html`
            <div class="image">
                <img src="${imgSrc}" 
                     alt="${document.title}"
                     onError="${(e) => {
                         if (document.diagramImage && !error) {
                             setError(true);
                             setImgSrc(`data:image/x-png;base64, ${document.diagramImage}`);
                         }
                     }}"/>
            </div>`;
    }

    const buildUrl = (pathname) => {
        return `${MC_BASE_URL}/oauth/frame/?token=${mcAccessToken}&redirect=${pathname}`;
    };

    const onEdit = () => {
        onOpenFrame(buildUrl(
            `/app/projects/${document.projectID}/diagrams/${document.documentID}/version/v.${document.major}.${document.minor}/edit`));
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
