import { Fragment, h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import htm from 'htm';
import { view } from '@forge/bridge';
import { Diagram } from './diagram.js';
import {
  compressForConfluence,
  calculateDataSize,
  extractBase64ForMacroBody,
  sizeConfig,
} from '../../../shared/js/imageUtils.js';

const html = htm.bind(h);

/** True when diagramCode looks like Mermaid text, not PNG/SVG base64. */
function looksLikeMermaidSource(value) {
  if (!value || typeof value !== 'string') {
    return false;
  }
  const text = value.trim();
  if (text.startsWith('data:') || text.startsWith('<svg') || text.startsWith('<?xml')) {
    return false;
  }
  const firstLine = text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('%%') && !line.startsWith('---'));
  if (!firstLine) {
    return false;
  }
  return /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|gitGraph|mindmap|timeline|quadrantChart|requirementDiagram|C4|sankey|xychart|block|packet|kanban|architecture|zenuml)/i.test(
    firstLine,
  );
}

const dropNulls = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, value]) => value != null));

export function Form({ mcAccessToken, onLogout }) {
  const [iframeURL, setIframeURL] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const saveInFlightRef = useRef(false);
  const iframeRef = useRef();

  const buildUrl = (pathname) => {
    return `${window.MC_BASE_URL}/oauth/frame/?token=${mcAccessToken}&redirect=${pathname}`;
  };

  const [data, setData] = useState({
    caption: '',
    size: 'Medium',
  });
  const dataRef = useRef();
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const saveDiagram = async () => {
    if (saveInFlightRef.current) {
      return;
    }
    saveInFlightRef.current = true;
    try {
      setIsSaving(true);

      const { diagramImage: rawImage, ...saveData } = dataRef.current;
      const imageCandidate =
        rawImage != null && rawImage !== ''
          ? rawImage
          : typeof saveData.diagramCode === 'string' &&
              !looksLikeMermaidSource(saveData.diagramCode)
            ? saveData.diagramCode
            : rawImage;
      let diagramImage =
        imageCandidate != null && imageCandidate !== ''
          ? extractBase64ForMacroBody(imageCandidate) || imageCandidate
          : imageCandidate;

      const mermaidSource =
        saveData.mcSourceCode ||
        (looksLikeMermaidSource(saveData.diagramCode) ? saveData.diagramCode : '') ||
        '';

      // Resubmit every Connect field so the first Forge save keeps legacy params.
      const macroParams = dropNulls({
        documentID: saveData.documentID,
        projectID: saveData.projectID,
        major: saveData.major,
        minor: saveData.minor,
        caption: saveData.caption,
        diagramCode: diagramImage,
        mcSourceCode: mermaidSource,
        mcDiagramType: saveData.mcDiagramType || 'unknown',
        size: saveData.size,
        updatedAt: String(Date.now()),
      });

      // Forge has no macro body — only config. Size is the submitted config only.
      let configSize = calculateDataSize(macroParams);
      console.info({ configSize, limit: sizeConfig.maxRequestSize }, 'Forge save config size');

      if (diagramImage && diagramImage.length > 0 && configSize > sizeConfig.maxRequestSize) {
        const compressed = await compressForConfluence(diagramImage);
        macroParams.diagramCode = compressed;
        configSize = calculateDataSize(macroParams);
        console.info({ configSize, limit: sizeConfig.maxRequestSize }, 'Forge save config size after compress');
        if (configSize > sizeConfig.maxRequestSize) {
          throw new Error(
            `Diagram is too complex (${(configSize / 1024).toFixed(2)}KB). Try simplifying your diagram or reducing the number of elements.`,
          );
        }
      }

      if (!macroParams.diagramCode) {
        throw new Error('Missing diagram image — cannot save empty preview to Confluence.');
      }

      await view.submit({ config: macroParams });
    } catch (error) {
      console.error({ err: error.message }, 'Save failed');

      let errorMessage = 'Unable to save diagram.';
      if (error.message && error.message.includes('too complex')) {
        errorMessage = error.message;
      } else if (error.message && error.message.includes('413')) {
        errorMessage =
          'Diagram is too large for Confluence. Please simplify your diagram by reducing the number of elements, text length, or complexity.';
      } else if (error.message) {
        errorMessage += ` ${error.message}`;
      }
      alert(errorMessage);
      setIsSaving(false);
    } finally {
      saveInFlightRef.current = false;
    }
  };

  const onOpenFrame = (url) => {
    setIframeURL(url);
  };

  useEffect(() => {
    (async () => {
      const context = await view.getContext();
      const config = context?.extension?.config || {};
      const {
        __bodyContent,
        ...params
      } = config;

      const next = {
        caption: '',
        size: 'Medium',
        ...params,
      };
      // Legacy Connect plain-text body is exposed once as __bodyContent.
      if (__bodyContent && !next.diagramImage && !looksLikeMermaidSource(__bodyContent)) {
        next.diagramImage = __bodyContent;
      } else if (!next.diagramImage && next.diagramCode && !looksLikeMermaidSource(next.diagramCode)) {
        next.diagramImage = next.diagramCode;
      }

      setData(next);
      dataRef.current = next;
      setInitialized(true);

      if (params.documentID) {
        setIframeURL(
          buildUrl(
            `/app/projects/${params.projectID}/diagrams/${params.documentID}/version/v${params.major}.${params.minor}/edit?pluginSource=confluence`,
          ),
        );
      }
    })().catch((e) => {
      console.error({ err: e.message }, 'Failed to load macro config');
      setInitialized(true);
    });

    window.onmessage = function (e) {
      // Only the Mermaid Chart editor iframe we opened may save, cancel or log out.
      if (!iframeRef.current || e.source !== iframeRef.current.contentWindow) {
        return;
      }
      if (!e.data || typeof e.data !== 'object') {
        return;
      }
      const action = e.data.action;
      const messageType = e.data.type;
      if (
        messageType === 'mermaid-chart-confluence-back' &&
        e.data.action === 'navigateBack'
      ) {
        setIframeURL('');
        view.close();
        return;
      }

      switch (action) {
        case 'cancel':
          setIframeURL('');
          break;

        case 'logout':
          onLogout();
          setIframeURL('');
          break;

        case 'save': {
          const saveDataWithDefaults = {
            caption: e.data.data.caption || '',
            size: e.data.data.size || 'Medium',
            ...e.data.data,
          };
          setData((prev) => {
            const merged = { ...prev, ...saveDataWithDefaults };
            dataRef.current = merged;
            return merged;
          });
          setIsSaving(true);
          setTimeout(() => {
            saveDiagram();
            setIframeURL('');
          }, 50);
          break;
        }
      }
    };
  }, []);

  if (iframeURL) {
    const iframeData = {
      document: data,
    };
    return html`
      <div class="iframe-container">
        <iframe ref=${iframeRef} src="${iframeURL}" name="${JSON.stringify(iframeData)}" />
      </div>
    `;
  }

  if (!initialized) {
    return html`
      <div id="page-spinner">
        <img src="./spinner.svg" alt="Loading" />
      </div>
    `;
  }

  return html`
    <${Fragment}>
      ${isSaving &&
      html`
        <div class="saving-indicator">Saving diagram...</div>
      `}
      <div class="wrapper">
        <${Diagram}
          document=${data}
          onOpenFrame=${onOpenFrame}
          mcAccessToken=${mcAccessToken}
        />
      </div>
    <//>
  `;
}
