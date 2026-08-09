export {
  createChromeMessagingTransport,
  resolveActiveTabId,
  type ChromeMessagingApi,
} from './createChromeMessagingTransport'

export { wrapScriptInjectionError } from './injectErrors'
export { extractPageSnapshotInPage, inspectPageContextInPage } from './pageDom'
