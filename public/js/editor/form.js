import { Fragment, h } from "https://esm.sh/preact";
import { useEffect, useRef, useState } from "https://esm.sh/preact/hooks";
import htm from "https://esm.sh/htm";
import { IMAGE_SIZES } from "/js/constatnts.js";
import { Diagram } from "./diagram.js";
import { Header } from "./header.js";
import { compressBase64Image,sizeConfig, calculateDataSize } from "/js/imageUtils.js";

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
  const [location, setLocation] = useState(null);

  const onOpenFrame = (url) => {
    setIframeURL(url);
  };

  const [data, setData] = useState({
    caption: "",
    size: "small",
  });
  const dataRef = useRef();
  useEffect(() => {
    dataRef.current = data;
  }, [Object.values(data)]);

  useEffect(() => {
    if (!window.AP || !window.AP.confluence) {
      return;
    }
    if (data.documentID && !iframeURL) {
      // window.AP.dialog.getButton('submit').enable();
      window.AP.dialog.getButton("submit").show();
    } else {
      // window.AP.dialog.getButton('submit').disable();
      window.AP.dialog.getButton("submit").hide();
    }
  }, [data.documentID, iframeURL]);

  useEffect(() => {
    window.AP.confluence.getMacroBody((macroBody) => {
      setData((data) => ({ ...data, diagramImage: macroBody }));
    });

    window.AP.confluence.getMacroData(({ __bodyContent: _, ...params }) => {
      setData((data) => ({ ...data, ...params }));
      setinitialized(true);
    });

  window.AP.events.on("dialog.submit", async () => {
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
        // Both diagramImage and saveData.diagramCode contain base64-encoded image data
      let bodyDataToSave = diagramImage;
      if (diagramImage && diagramImage.length > 0) {
        const macroParamsSize = calculateDataSize(macroParams);
        const bodyDataSize = calculateDataSize(diagramImage);
        const totalSize = macroParamsSize + bodyDataSize;

        if (totalSize > sizeConfig.maxUncompressedSize) {
          // Compress both base64 images if the total size is too large
          bodyDataToSave = await compressBase64Image(
            diagramImage, 
            sizeConfig.compressionQuality, 
            sizeConfig.compressionMaxWidth
          ).catch(() => diagramImage);
          
          macroParams.diagramCode = await compressBase64Image(
            saveData.diagramCode, 
            sizeConfig.compressionQuality, 
            sizeConfig.compressionMaxWidth
          ).catch(() => saveData.diagramCode);
        } 
      }
      
      await window.AP.confluence.saveMacro(macroParams, bodyDataToSave);
      window.AP.confluence.closeMacroEditor();

    } catch (error) {
      console.error("The diagram is too large to save, Try simplifying your diagram or reducing its complexity");
    }
  });

    window.AP.dialog.disableCloseOnSubmit();

    window.onmessage = function (e) {
      const action = e.data.action;
      switch (action) {
        case "cancel":
          setIframeURL("");
          break;

        case "logout":
          onLogout();
          setIframeURL("");
          break;

        case "save":
          setData((prev) => ({ ...prev, ...e.data.data }));
          setIframeURL("");
          break;
      }
    };
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        const locationData = await getLocationWithTimeout(2000);
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
      <iframe src="${iframeURL}" name="${JSON.stringify(iframeData)}" />
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
            <${Header} user="${user}" onLogout="${onLogout}"/>
            <div class="wrapper">
                <${Diagram} document=${data} onOpenFrame="${onOpenFrame}"
                            mcAccessToken="${mcAccessToken}"/>
                <div id="form-container">
                    <div class="form-row">
                        <label class="label">Caption</label>
                        <div class="field">
                            <input
                                    type="text"
                                    name="caption"
                                    value="${data.caption}"
                                    onInput="${(e) =>
                                      setData((prev) => ({
                                        ...prev,
                                        caption: e.target.value,
                                      }))}"
                            />
                        </div>
                    </div>
                    <div class="form-row">
                        <label class="label">Diagram size</label>
                        <div class="field">
                            <select
                                    name="size"
                                    value="${data.size}"
                                    onChange="${(e) =>
                                      setData((prev) => ({
                                        ...prev,
                                        size: e.currentTarget.value,
                                      }))}"
                            >
                                ${Object.keys(IMAGE_SIZES).map(
                                  (s) => html` <option name="${s}">
                                    ${s}
                                  </option>`
                                )}
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        </Fragment>
    `;
}
