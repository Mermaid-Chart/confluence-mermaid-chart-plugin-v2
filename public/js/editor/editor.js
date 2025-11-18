import {h, render} from 'https://esm.sh/preact';
import {useState, useEffect} from 'https://esm.sh/preact/hooks';
import htm from 'https://esm.sh/htm';
import {Login} from './login.js';
import {Form} from './form.js';
import {SvelteEditorWrapper} from './svelteEditorWrapper.js';
import {DiagramSelector} from './diagramSelector.js';
import {getSampleDiagrams} from "/js/mermaid.js";

const html = htm.bind(h);

function App() {
    const [accessToken, setAccessToken] = useState(mcAccessToken);
    const [user, setUser] = useState(loggedUser);
    const [showNoLoginEditor, setShowNoLoginEditor] = useState(false);
    const [showDiagramSelector, setShowDiagramSelector] = useState(false);
    const [isEditingMermaidDiagram, setIsEditingMermaidDiagram] = useState(false);
    const [existingDiagramData, setExistingDiagramData] = useState(null);
    useEffect(() => {
        if (window.AP && window.AP.confluence) {
            window.AP.confluence.getMacroData((data) => {
                if (data && data.diagramType === 'mermaid' && data.diagramCode) {
                    setIsEditingMermaidDiagram(true);
                    setExistingDiagramData(data);
                    setShowNoLoginEditor(true);
                }
            });
        }
    }, []);

    const onLogin = (token, user) => {
        setAccessToken(token);
        setUser(user);
    }
    
    const onCancel = () => {
        if (window.AP && window.AP.confluence) {
            window.AP.confluence.closeMacroEditor();
        } else if (window.CP) {
            window.CP.cancel();
        }
    }
    
    const onLogout = async () => {
        await fetch('/logout', {
            method: 'post',
            headers: {
                Authorization: `JWT ${JWTToken}`,
            },
        });
        setAccessToken(undefined)
        setUser(null)
        window.location.reload();
    }
    
    const onOpenDiagramSelector = () => {
        setShowDiagramSelector(true);
        return false;
    }

    const onSelectDiagram = (diagram) => {
        setExistingDiagramData({
            diagramCode: diagram.code,
            diagramType: 'mermaid',
            size: 'medium'
        });
        setShowDiagramSelector(false);
        setShowNoLoginEditor(true);
    }

    const onCloseDiagramSelector = () => {
        setShowDiagramSelector(false);
    }
    
    const onNoLoginClick = (diagramType = null) => {
        if (diagramType) {
            try {
                const sampleDiagrams = getSampleDiagrams();
                const diagramCode = sampleDiagrams[diagramType] || sampleDiagrams['flowchart'] || '';
                setExistingDiagramData({
                    diagramCode: diagramCode,
                    diagramType: 'mermaid',
                    size: 'medium'
                });
            } catch (error) {
                console.error('Error loading diagram templates:', error);
                setExistingDiagramData({
                    diagramCode: '',
                    diagramType: 'mermaid',
                    size: 'medium'
                });
            }
        }
        setShowNoLoginEditor(true);
        return false;
    }

    if (showDiagramSelector) {
        return html`
            <${DiagramSelector} 
                onSelectDiagram=${onSelectDiagram}
                onCancel=${onCloseDiagramSelector}
            />
        `;
    }

    if (showNoLoginEditor) {
        return html`
             <${SvelteEditorWrapper} 
                component="NoLoginEditor"
                onCancel=${onCancel} 
                existingDiagramData=${existingDiagramData}
                isEditMode=${isEditingMermaidDiagram} 
            />
        `;
    }

    if (!accessToken) {
        return html`
            <${Login} 
                onLogin=${onLogin} 
                onCancel=${onCancel} 
                onNoLoginClick=${onNoLoginClick} 
                onOpenDiagramSelector=${onOpenDiagramSelector}
            />
        `;
    }

    return html`
        <${Form} 
            user=${user} 
            onLogout=${onLogout}
            mcAccessToken=${accessToken}
        />
    `;
}

render(html`
    <${App}/>`, document.getElementById('editor-content'));
