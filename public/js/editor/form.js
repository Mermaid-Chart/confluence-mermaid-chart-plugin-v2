import { Fragment, h } from "https://esm.sh/preact";
import { useEffect, useRef, useState } from "https://esm.sh/preact/hooks";
import htm from "https://esm.sh/htm";
import { Diagram } from "./diagram.js";
import { Header } from "./header.js";
import {
  compressForConfluence,
  sizeConfig,
  calculateDataSize,
  extractBase64ForMacroBody,
} from "/js/imageUtils.js?v=svg-sanitize-3";

const html = htm.bind(h);

/** True when diagramCode looks like Mermaid text, not PNG/SVG base64. */
function looksLikeMermaidSource(value) {
  if (!value || typeof value !== "string") {
    return false;
  }
  const text = value.trim();
  if (text.startsWith("data:") || text.startsWith("<svg") || text.startsWith("<?xml")) {
    return false;
  }
  // Image base64 (e.g. PHN2Zy… for SVG) has no mermaid keywords on the first line
  const firstLine = text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("%%") && !line.startsWith("---"));
  if (!firstLine) {
    return false;
  }
  return /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|gitGraph|mindmap|timeline|quadrantChart|requirementDiagram|C4|sankey|xychart|block|packet|kanban|architecture|zenuml)/i.test(
    firstLine,
  );
}

function getLocationWithTimeout(timeout) {
  return new Promise((resolve, reject) => {
    const timerId = setTimeout(() => {
      clearTimeout(timerId);
      reject(new Error("Timeout exceeded"));
    }, timeout);

    window.AP.getLocation(function (location) {
      clearTimeout(timerId);
      resolve(location);
    });
  });
}

export function Form({ mcAccessToken, user, onLogout }) {
  const [iframeURL, setIframeURL] = useState("");
  const [initialized, setinitialized] = useState(false);
  const [location, setLocation] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const saveInFlightRef = useRef(false);

  const buildUrl = (pathname) => {
    return `${MC_BASE_URL}/oauth/frame/?token=${mcAccessToken}&redirect=${pathname}`;
  };

  const saveDiagram = async () => {
    if (saveInFlightRef.current) {
      return;
    }
    saveInFlightRef.current = true;
    try {
      setIsSaving(true);

      const { diagramImage: rawImage, ...saveData } = dataRef.current;
      // Prefer diagramImage; fall back to legacy image-in-diagramCode from older collab clients
      const imageCandidate =
        rawImage != null && rawImage !== ""
          ? rawImage
          : typeof saveData.diagramCode === "string" &&
              !looksLikeMermaidSource(saveData.diagramCode)
            ? saveData.diagramCode
            : rawImage;
      // extractBase64ForMacroBody bakes viewBox pixel width/height into SVG so
      // width/height="100%" does not render as a blank box in Confluence iframes.
      let diagramImage =
        imageCandidate != null && imageCandidate !== ""
          ? extractBase64ForMacroBody(imageCandidate) || imageCandidate
          : imageCandidate;

      const mermaidSource =
        saveData.mcSourceCode ||
        (looksLikeMermaidSource(saveData.diagramCode) ? saveData.diagramCode : "") ||
        "";

      // Keep image in BOTH macro body and diagramCode. After refresh, getMacroBody is often
      // empty in the viewer iframe while getMacroData still has diagramCode — that was the
      // pre-d5330e5 path that made diagrams persist. mcSourceCode holds Mermaid text.
      const macroParams = {
        documentID: saveData.documentID,
        projectID: saveData.projectID,
        major: saveData.major,
        minor: saveData.minor,
        caption: saveData.caption,
        diagramCode: diagramImage,
        mcSourceCode: mermaidSource,
        mcDiagramType: saveData.mcDiagramType || "unknown",
        size: saveData.size,
        // Bust Confluence editor preview iframe cache after save (wired into viewer URL)
        updatedAt: String(Date.now()),
      };

      if (window.AP.dialog.getButton) {
        window.AP.dialog.getButton("submit").hide();
      }

      const macroParamsSize = calculateDataSize(macroParams);
      let bodyDataToSave = diagramImage;

      if (diagramImage && diagramImage.length > 0) {
        const bodyDataSize = calculateDataSize(diagramImage);
        const totalSize = macroParamsSize + bodyDataSize;

        if (totalSize > sizeConfig.maxRequestSize) {
          bodyDataToSave = await compressForConfluence(diagramImage);
          // Keep param fallback in sync with body (same image, compressed).
          macroParams.diagramCode = bodyDataToSave;
          const finalBodySize = calculateDataSize(bodyDataToSave);
          const finalParamsSize = calculateDataSize(macroParams);
          const finalTotalSize = finalBodySize + finalParamsSize;
          if (finalTotalSize > sizeConfig.maxRequestSize) {
            throw new Error(`Diagram is too complex (${(finalTotalSize / 1024).toFixed(2)}KB). Try simplifying your diagram or reducing the number of elements.`);
          }
        }
      }

      if (!bodyDataToSave) {
        throw new Error("Missing diagram image — cannot save empty preview to Confluence.");
      }

      await window.AP.confluence.saveMacro(macroParams, bodyDataToSave);
      await new Promise(resolve => setTimeout(resolve, 800));
      window.AP.confluence.closeMacroEditor();
    } catch (error) {
      console.error('❌ Save failed:', error);

      let errorMessage = 'Unable to save diagram.';
      if (error.message && error.message.includes('too complex')) {
        errorMessage = error.message;
      } else if (error.message && error.message.includes('413')) {
        errorMessage = 'Diagram is too large for Confluence. Please simplify your diagram by reducing the number of elements, text length, or complexity.';
      } else if (error.message) {
        errorMessage += ` ${error.message}`;
      }
      alert(errorMessage);

      if (window.AP.dialog.getButton) {
        window.AP.dialog.getButton("submit").show();
      }
      setIsSaving(false);
    } finally {
      saveInFlightRef.current = false;
    }
  };


  const onOpenFrame = (url) => {
    setIframeURL(url);
  };

  const [data, setData] = useState({
    caption: "",
    size: "Medium",
  });
  const dataRef = useRef();
  useEffect(() => {
    dataRef.current = data;
  }, [Object.values(data)]);


  useEffect(() => {
    window.AP.confluence.getMacroBody((macroBody) => {
      setData((data) => ({ ...data, diagramImage: macroBody }));
    });

    window.AP.confluence.getMacroData(({ __bodyContent: _, ...params }) => {
      setData((data) => ({ ...data, ...params }));
      setinitialized(true);

      if (params.documentID) {
        const editUrl = buildUrl(
          `/app/projects/${params.projectID}/diagrams/${params.documentID}/version/v${params.major}.${params.minor}/edit?pluginSource=confluence`
        );
        // Edit/insert Mixpanel events fire on collab save (not on open) to match no-auth
        setIframeURL(editUrl);
      }
    });

    window.AP.events.on("dialog.submit", saveDiagram);

    window.AP.dialog.disableCloseOnSubmit();

    window.onmessage = function (e) {
      const action = e.data.action;
      const messageType = e.data.type;
      if (messageType === 'mermaid-chart-confluence-back' && e.data.action === 'navigateBack') {
        setIframeURL("");
        if (window.AP && window.AP.confluence) {
          window.AP.confluence.closeMacroEditor();
        }
        return;
      }

      switch (action) {
        case "cancel":
          setIframeURL("");
          break;

        case "logout":
          onLogout();
          setIframeURL("");
          break;

        case "save": {
          const saveDataWithDefaults = {
            caption: e.data.data.caption || "",
            size: e.data.data.size || "Medium",
            ...e.data.data
          };
          setData((prev) => {
            const merged = { ...prev, ...saveDataWithDefaults };
            dataRef.current = merged;
            const d = merged.diagramImage;
            const head =
              typeof d === "string"
                ? d.slice(0, 80)
                : d == null
                  ? "(none)"
                  : typeof d;
            return merged;
          });
          setIsSaving(true);
          setTimeout(() => {
            saveDiagram();
            setIframeURL("");
          }, 50);
          break;
        }
      }
    };
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        const locationData = await getLocationWithTimeout(4000);
        setLocation(locationData);
      } catch (error) {
        console.error("Error getting location:", error);
      }
    }

    fetchData();
  }, []);

  if (iframeURL) {
    const iframeData = {
      document: data,
    };
    return html`
      <div class="iframe-container">

        <iframe src="${iframeURL}" name="${JSON.stringify(iframeData)}" />
      </div>
    `;
  }

  if (!location) {
    return html`
      <div id="page-spinner" style="flex-direction: column;">
        <h2 class="error">
          Due to limitations in the Jira framework, the app will not work in the
          embedded confluence within Jira.
        </h2>
        <h2 class="error">
          Please try to open the page in confluence directly.
        </h2>
        <br />
        <p>Use 'Esc' keyboard button to close macros dialog.</p>
      </div>
    `;
  }

  if (!initialized) {
    return html`
      <div id="page-spinner">
        <img src="/spinner.svg" alt="Loading" />
      </div>
    `;
  }

  return html`
        <${Fragment}>
            ${isSaving && html`
              <div class="saving-indicator">
                Saving diagram...
              </div>
            `}
                 <div class="wrapper">
                <${Diagram} document=${data} onOpenFrame="${onOpenFrame}"
                            mcAccessToken="${mcAccessToken}"/>
            </div>
        </Fragment>
    `;
}
