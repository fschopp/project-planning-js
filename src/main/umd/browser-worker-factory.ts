import { workerFactory } from '../worker-interface';

function isHtmlScriptElement(scriptElement: HTMLOrSVGScriptElement): scriptElement is HTMLScriptElement {
  return 'src' in scriptElement;
}

const THIS_SCRIPT_URL: string | undefined =
    (document && document.currentScript && isHtmlScriptElement(document.currentScript) && document.currentScript.src)
        ? document.currentScript.src
        : undefined;

workerFactory.createWorker = () => {
  // Notes:
  // 1. The expectation is that the current script is loaded through a <script> element with a context that sets
  //    document.currentScript. This excludes newer contexts such as running as a module script or running in a shadow
  //    tree. https://html.spec.whatwg.org/multipage/dom.html#dom-document-currentscript
  //    If you are seeing this error, either change the <script> element to a more traditional context, or use the ES6
  //    module distribution from dist/es6 and use a bundler for your web app.
  // 2. Current browsers do not support {type: 'module'} as `options` argument yet.
  return THIS_SCRIPT_URL === undefined
      ? 'Failed to create web worker because the URL of the current script could not be determined.'
      : new Worker(THIS_SCRIPT_URL);
};
