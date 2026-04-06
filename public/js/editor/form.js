import { Fragment, h } from "https://esm.sh/preact";
import { useEffect, useRef, useState } from "https://esm.sh/preact/hooks";
import htm from "https://esm.sh/htm";
import { Header } from "./header.js";
import { compressForConfluence, sizeConfig, calculateDataSize } from "/js/imageUtils.js";
import analytics from "../lib/analytics.js";

const html = htm.bind(h);

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
  
  const buildUrl = (pathname) => {
    return `${MC_BASE_URL}/oauth/frame/?token=${mcAccessToken}&redirect=${pathname}`;
  };

 const saveDiagram = async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    
    const { diagramImage, ...saveData } = dataRef.current;
    const macroParams = {
      documentID: saveData.documentID,
      projectID: saveData.projectID,
      major: saveData.major,
      minor: saveData.minor,
      caption: saveData.caption,
      diagramCode: saveData.diagramCode,
      size: saveData.size
    };
    
    try {
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
          macroParams.diagramCode = await compressForConfluence(saveData.diagramCode);
          const finalBodySize = calculateDataSize(bodyDataToSave);
          const finalParamsSize = calculateDataSize(macroParams);
          const finalTotalSize = finalBodySize + finalParamsSize;
          if (finalTotalSize > sizeConfig.maxRequestSize) {
            throw new Error(`Diagram is too complex (${(finalTotalSize / 1024).toFixed(2)}KB). Try simplifying your diagram or reducing the number of elements.`);
          }
        }
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
    }
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
        analytics.trackPluginDiagramEdit();
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

        case "save":
          const saveDataWithDefaults = {
            caption: e.data.data.caption || "",
            size: e.data.data.size || "Medium",
            ...e.data.data
          };
          setData((prev) => ({ ...prev, ...saveDataWithDefaults }));
          setIsSaving(true);
          setTimeout(() => {
            saveDiagram();
            setIframeURL(""); 
          }, 50);
          break;
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
            <${Header} user="${user}" onLogout="${onLogout}"/>
        </Fragment>
    `;
}
