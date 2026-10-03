window.__ModuleLoader__.load({ id: "dsh-kylin-vibe", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
var __bundleRequire = typeof require === "function" ? require : undefined;
window.addEventListener("error", function (e) { (window.__gvErrors = window.__gvErrors || []).push(String(e.message)); });
window.addEventListener("unhandledrejection", function (e) { (window.__gvErrors = window.__gvErrors || []).push("rej: " + String(e.reason)); });

"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  createKbRuntime: () => createKbRuntime,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);

// src/client/locales.ts
var NS = "kyGraph";
var zh = {
  nav: "\u77E5\u8BC6\u56FE\u8C31",
  title: "\u77E5\u8BC6\u56FE\u8C31",
  subtitle: "\u628A\u6388\u6743\u8BED\u6599\u7D22\u5F15\u6210\u5B9E\u4F53-\u5173\u7CFB-\u793E\u533A\u56FE\u8C31\uFF1Bagent \u53EF\u7ECF graphrag_* \u5DE5\u5177\u68C0\u7D22\u3002",
  newKb: "\u65B0\u5EFA\u77E5\u8BC6\u5E93",
  closeForm: "\u6536\u8D77",
  dismiss: "\u77E5\u9053\u4E86",
  loadFailed: "\u52A0\u8F7D\u5931\u8D25",
  empty: "\u8FD8\u6CA1\u6709\u77E5\u8BC6\u5E93\u3002\u70B9\u51FB\u53F3\u4E0A\u89D2\u300C\u65B0\u5EFA\u77E5\u8BC6\u5E93\u300D\u5F00\u59CB\u3002",
  formName: "\u540D\u79F0",
  formNameHint: "\u4F8B\u5982\uFF1Aatlas \u4EE3\u7801\u5E93",
  formRoots: "\u6388\u6743\u76EE\u5F55\uFF08\u6BCF\u884C\u4E00\u4E2A\u7EDD\u5BF9\u8DEF\u5F84\uFF09",
  formRootsHint: "/Users/me/projects/atlas",
  formDesc: "\u63CF\u8FF0\uFF08\u53EF\u9009\uFF09",
  formDescHint: "\u8FD9\u4EFD\u8BED\u6599\u7684\u7528\u9014",
  create: "\u521B\u5EFA",
  cancel: "\u53D6\u6D88",
  managedByConfig: "\u914D\u7F6E\u6258\u7BA1",
  phaseError: "\u51FA\u9519",
  phaseDone: "\u5B8C\u6210",
  noRoots: "\uFF08\u672A\u914D\u7F6E\u6388\u6743\u76EE\u5F55\uFF09",
  filesIndexed: "\u5DF2\u7D22\u5F15\u6587\u4EF6",
  entities: "\u5B9E\u4F53",
  relations: "\u5173\u7CFB",
  quarantined: "\u9694\u79BB",
  lastIndex: "\u6700\u540E\u7D22\u5F15",
  never: "\u4ECE\u672A",
  phaseLabel: "\u9636\u6BB5",
  lastReport: "\u4E0A\u6B21\uFF1A+{added} \u5B9E\u4F53 / +{relations} \u5173\u7CFB / {calls} \u6B21 LLM",
  index: "\u7D22\u5F15",
  cancelIndex: "\u53D6\u6D88\u7D22\u5F15",
  delete: "\u5220\u9664",
  confirmDelete: "\u5220\u9664\u77E5\u8BC6\u5E93\u300C{name}\u300D\uFF1F\u56FE\u8C31\u6570\u636E\u5C06\u88AB\u6E05\u9664\u3002",
  channelUnavailable: "\u77E5\u8BC6\u56FE\u8C31\u901A\u9053\u4E0D\u53EF\u7528 (the graphrag channel is unavailable)",
  createDone: "\u521B\u5EFA\u6210\u529F",
  createFailed: "\u521B\u5EFA\u5931\u8D25",
  updateDone: "\u5DF2\u66F4\u65B0",
  updateFailed: "\u66F4\u65B0\u5931\u8D25",
  deleteDone: "\u5DF2\u5220\u9664",
  deleteFailed: "\u5220\u9664\u5931\u8D25",
  indexStarted: "\u7D22\u5F15\u5DF2\u542F\u52A8",
  indexFailed: "\u7D22\u5F15\u542F\u52A8\u5931\u8D25",
  cancelDone: "\u5DF2\u8BF7\u6C42\u53D6\u6D88",
  cancelFailed: "\u53D6\u6D88\u5931\u8D25",
  tabBrowse: "\u6D4F\u89C8",
  tabReview: "\u51C6\u786E\u6027\u62BD\u67E5",
  tabHealth: "\u4F53\u68C0\u62A5\u544A",
  searchPlaceholder: "\u641C\u7D22\u5B9E\u4F53\uFF08Enter \u68C0\u7D22\uFF09",
  search: "\u68C0\u7D22",
  loading: "\u52A0\u8F7D\u4E2D\u2026",
  noEntities: "\u6CA1\u6709\u547D\u4E2D\u7684\u5B9E\u4F53\u3002",
  reviewHint: "\u7B2C {i}/{n} \u6761\uFF08\u5DF2\u5B8C\u6210 {done}\uFF09\uFF1A\u8FD9\u6761\u5173\u7CFB\u5728\u539F\u6587\u4E2D\u6210\u7ACB\u5417\uFF1F",
  reviewQuestion: "\u4EE5\u4E0B\u539F\u6587\u662F\u5426\u652F\u6301\u8FD9\u6761\u5173\u7CFB\uFF1F",
  confidence: "\u7F6E\u4FE1\u5EA6",
  verdictCorrect: "\u6B63\u786E",
  verdictWrong: "\u9519\u8BEF",
  verdictUnsure: "\u5B58\u7591",
  resample: "\u91CD\u65B0\u62BD\u6837",
  reviewExhausted: "\u672C\u8F6E\u62BD\u67E5\u5B8C\u6210\uFF08{done} \u6761\uFF09\u3002\u6807\u8BB0\u4E3A\u201C\u9519\u8BEF\u201D\u7684\u5173\u7CFB\u5DF2\u5728\u68C0\u7D22\u4E2D\u6392\u9664\u3002",
  healthTitle: "\u4F53\u68C0\u62A5\u544A",
  coverage: "\u6587\u4EF6\u8986\u76D6\u7387",
  stale: "\u9648\u65E7",
  samplePrecision: "\u62BD\u6837\u7CBE\u786E\u7387",
  excluded: "\u5DF2\u6392\u9664\u5173\u7CFB",
  healthNote: "\u8986\u76D6\u7387\u4E3A\u5DF2\u7D22\u5F15/\u53D7\u626B\u6587\u4EF6\u6BD4\uFF1B\u62BD\u6837\u7CBE\u786E\u7387\u6765\u81EA\u201C\u51C6\u786E\u6027\u62BD\u67E5\u201D\u7684\u4EBA\u5DE5\u5224\u5B9A\uFF1B\u6807\u8BB0\u9519\u8BEF\u7684\u5173\u7CFB\u4E0D\u518D\u53C2\u4E0E\u68C0\u7D22\u3002",
  explore: "\u6D4F\u89C8 / \u5BA1\u67E5",
  closeExplore: "\u6536\u8D77",
  pickDir: "\u9009\u62E9\u76EE\u5F55",
  pickUnavailable: "\u5F53\u524D\u73AF\u5883\u6CA1\u6709\u53EF\u7528\u7684\u76EE\u5F55\u9009\u62E9\u5668\uFF0C\u8BF7\u5728\u4E0B\u65B9\u624B\u52A8\u8F93\u5165\u7EDD\u5BF9\u8DEF\u5F84",
  formWorkspace: "\u5DE5\u4F5C\u533A\uFF08Agent \u4EE3\u5EFA\u843D\u70B9\uFF09",
  formWorkspaceFollow: "\u8DDF\u968F\u5F53\u524D\u4F1A\u8BDD",
  formModel: "\u4F1A\u8BDD\u6A21\u578B\uFF08Agent \u5BF9\u8BDD\u7528\uFF09",
  formModelFollow: "\u8DDF\u968F\u4F1A\u8BDD\u9ED8\u8BA4",
  formModelHint: "\u56FE\u8C31\u62BD\u53D6\u6A21\u578B\u4E0D\u5728\u6B64\u9009\u62E9\uFF1A\u63D2\u4EF6\u914D\u7F6E\u4E86 model \u5C31\u7528\u5B83\uFF1B\u5426\u5219\u81EA\u52A8\u8DDF\u968F\u8FD9\u91CC\u9009\u5B9A\u7684\u4F1A\u8BDD\u6A21\u578B",
  agentDelegate: "Agent \u4EE3\u5EFA",
  agentDelegateHint: "\u6CA1\u6709\u5408\u9002\u76EE\u5F55\uFF1F\u8BA9 agent \u626B\u63CF\u5F53\u524D\u5DE5\u4F5C\u533A\u5E76\u5F81\u6C42\u4F60\u786E\u8BA4\u540E\u518D\u5EFA\u5E93",
  agentDelegateEmpty: "\u8BA9 Agent \u4EE3\u5EFA",
  agentCreatePrompt: "\u8BF7\u521B\u5EFA\u77E5\u8BC6\u56FE\u8C31\u77E5\u8BC6\u5E93\u5E76\u5B8C\u6210\u7D22\u5F15\u3002\n- \u540D\u79F0\uFF1A{name}\n- \u6388\u6743\u76EE\u5F55\uFF08\u53EA\u7D22\u5F15\u8FD9\u4E9B\u76EE\u5F55\uFF09\n{roots}\n- \u6B65\u9AA4\uFF1A\u8C03\u7528 graphrag_index\uFF08kb=\u300C{name}\u300D\u3001create=true\u3001roots=\u4E0A\u8FF0\u76EE\u5F55\uFF09\uFF1B\u51FA\u73B0\u5BA1\u6279\u5361\u65F6\u5411\u6211\u786E\u8BA4\u3002\n- \u9A8C\u6536\uFF1A\u7528 graphrag_status \u786E\u8BA4\u5DF2\u7D22\u5F15\u6587\u4EF6 > 0\uFF0C\u5E76\u62A5\u544A\u5B9E\u4F53/\u5173\u7CFB/\u793E\u533A\u6570\u91CF\u4E0E\u9694\u79BB\u6570\u3002\n- \u505C\u6B62\uFF1Astatus \u62A5\u544A\u5B8C\u6210\u5373\u505C\u6B62\uFF0C\u4E0D\u8981\u505A\u5176\u4ED6\u4E8B\uFF0C\u4E0D\u8981\u4FEE\u6539\u4EFB\u4F55\u6587\u4EF6\u3002",
  agentExplorePrompt: "\u8BF7\u4E3A\u5F53\u524D\u5DE5\u4F5C\u533A\u521B\u5EFA\u77E5\u8BC6\u56FE\u8C31\u77E5\u8BC6\u5E93\uFF1A\u5148\u67E5\u770B\u5DE5\u4F5C\u533A\u76EE\u5F55\u7ED3\u6784\uFF0C\u6311\u9009\u503C\u5F97\u7D22\u5F15\u7684\u76EE\u5F55\uFF08\u6E90\u7801/\u6587\u6863\uFF1B\u6392\u9664\u4F9D\u8D56\u76EE\u5F55\u3001\u6784\u5EFA\u4EA7\u7269\u3001.git\uFF09\uFF0C\u628A\u5019\u9009\u6E05\u5355\u548C\u7406\u7531\u544A\u8BC9\u6211\u5E76\u7B49\u6211\u786E\u8BA4\uFF1B\u6211\u786E\u8BA4\u540E\u518D\u8C03\u7528 graphrag_index\uFF08kb + create=true\uFF09\u5EFA\u5E93\u5E76\u7D22\u5F15\uFF0C\u5B8C\u6210\u540E\u7528 graphrag_status \u62A5\u544A\u89C4\u6A21\uFF08\u5B9E\u4F53/\u5173\u7CFB/\u793E\u533A/\u9694\u79BB\u6570\uFF09\u3002\u51FA\u73B0\u5BA1\u6279\u5361\u65F6\u5411\u6211\u8BF4\u660E\u5185\u5BB9\u518D\u8BF7\u6C42\u6279\u51C6\u3002",
  delegateSubmitted: "\u5DF2\u4EA4\u7ED9\u4F1A\u8BDD\u4E2D\u7684 agent \u6267\u884C\uFF0C\u8BF7\u56DE\u5230\u5BF9\u8BDD\u8DDF\u8FDB\u5BA1\u6279\u4E0E\u7ED3\u679C",
  delegateDraft: "\u63D0\u793A\u8BCD\u5DF2\u586B\u5165\u4F1A\u8BDD\u8F93\u5165\u6846\u2014\u2014\u8BF7\u68C0\u67E5\u540E\u70B9\u53D1\u9001",
  delegateCopied: "\u63D0\u793A\u8BCD\u5DF2\u590D\u5236\u5230\u526A\u8D34\u677F\u2014\u2014\u8BF7\u7C98\u8D34\u5230\u4F1A\u8BDD\u53D1\u9001",
  delegateNone: "\u65E0\u6CD5\u6295\u9012\u5230\u4F1A\u8BDD\uFF08\u526A\u8D34\u677F\u4E5F\u4E0D\u53EF\u7528\uFF09",
  delegateRootsRequired: "\u8BF7\u5148\u9009\u62E9\u6216\u586B\u5199\u81F3\u5C11\u4E00\u4E2A\u6388\u6743\u76EE\u5F55",
  correctionTitle: "\u63D0\u4EA4\u66F4\u6B63\uFF08\u53EF\u9009\uFF09\uFF1A\u628A\u8FD9\u6761\u5173\u7CFB\u6539\u6210\u6B63\u786E\u5199\u6CD5\uFF0C\u6216\u4EC5\u505A\u6807\u8BB0",
  correctionS: "\u4E3B\u8BED",
  correctionR: "\u5173\u7CFB",
  correctionO: "\u5BBE\u8BED",
  correctionSubmit: "\u63D0\u4EA4\u66F4\u6B63",
  verdictOnlyWrong: "\u4EC5\u6807\u8BB0\u9519\u8BEF",
  verdictOnlyUnsure: "\u4EC5\u6807\u8BB0\u5B58\u7591",
  healthCorrected: "\u5DF2\u66F4\u6B63",
  selCorrect: "\u66F4\u6B63\u6240\u9009",
  selHint: "\u6ED1\u9009\u8BC1\u636E\u539F\u6587\u540E\u70B9\u300C\u66F4\u6B63\u6240\u9009\u300D\uFF0C\u5DF2\u6309\u6240\u9009\u539F\u6587\u9884\u586B",
  selNoTriple: "\u672A\u80FD\u4ECE\u6240\u9009\u539F\u6587\u89E3\u6790\u51FA\u4E09\u5143\u7EC4\uFF0C\u8BF7\u624B\u52A8\u586B\u5199",
  selFailed: "\u9009\u533A\u89E3\u6790\u5931\u8D25",
  tabManage: "\u77E5\u8BC6\u7BA1\u7406",
  manageAddTitle: "\u8865\u5145\u65B0\u77E5\u8BC6\uFF08\u7C98\u8D34\u6587\u672C\uFF0C\u5165\u5E93\u540E\u81EA\u52A8\u589E\u91CF\u7D22\u5F15\uFF09",
  manageAddName: "\u6807\u9898",
  manageAddNameHint: "\u5982\uFF1A\u6DB2\u51B7\u8BBE\u5907\u5DE1\u68C0\u8981\u70B9\uFF08\u53EF\u4E0D\u586B\uFF0C\u7F3A\u7701\u6309\u65F6\u95F4\u547D\u540D\uFF09",
  manageAddText: "\u6B63\u6587\uFF08markdown\uFF09",
  manageAddTextHint: "\u7C98\u8D34\u8981\u5165\u5E93\u7684\u8D44\u6599\u539F\u6587\uFF0C\u652F\u6301 markdown\uFF1B\u5165\u5E93\u540E\u81EA\u52A8\u62BD\u53D6\u5B9E\u4F53\u4E0E\u5173\u7CFB",
  manageAddSubmit: "\u5165\u5E93\u5E76\u7D22\u5F15",
  manageSources: "\u5DF2\u5165\u5E93\u6765\u6E90",
  manageDelete: "\u5220\u9664",
  manageConfirmDelete: "\u5220\u9664\u8BE5\u6765\u6E90\u7684\u5168\u90E8\u56FE\u8C31\u6570\u636E\uFF1F\uFF08\u4E0D\u53EF\u6062\u590D\uFF09",
  manageNoteAdded: "\u5DF2\u5165\u5E93\uFF0C\u540E\u53F0\u7D22\u5F15\u4E2D",
  manageFileDeleted: "\u5DF2\u5220\u9664\u8BE5\u6765\u6E90",
  manageRootsTitle: "\u6388\u6743\u76EE\u5F55\uFF08\u6BCF\u884C\u4E00\u4E2A\u7EDD\u5BF9\u8DEF\u5F84\uFF0C\u4FDD\u5B58\u540E\u70B9\u300C\u7D22\u5F15\u300D\u6536\u7F16\u65B0\u6587\u4EF6\uFF09",
  manageRootsSave: "\u4FDD\u5B58\u76EE\u5F55",
  manageRootsSaved: "\u6388\u6743\u76EE\u5F55\u5DF2\u66F4\u65B0",
  manageEmpty: "\u8FD8\u6CA1\u6709\u5DF2\u5165\u5E93\u6765\u6E90\u3002",
  manageImport: "\u5BFC\u5165\u6587\u4EF6\uFF08\u9009\u62E9\u76EE\u5F55\uFF09",
  manageImported: "\u5DF2\u5BFC\u5165 {count} \u4E2A\u6587\u4EF6\uFF08\u8DF3\u8FC7 {skipped} \u4E2A\uFF09\uFF0C\u540E\u53F0\u7D22\u5F15\u4E2D",
  manageFilterHint: "\u6309\u8DEF\u5F84\u7B5B\u9009\u2026",
  manageNoMatch: "\u6CA1\u6709\u5339\u914D\u7684\u6765\u6E90\u3002",
  manageChanges: "\u68C0\u6D4B\u5230\u53D8\u66F4\uFF1A\u65B0\u589E {added} / \u4FEE\u6539 {changed} / \u5220\u9664 {removed}",
  manageSyncIndex: "\u540C\u6B65\u7D22\u5F15",
  manageContribution: "\u5757 {chunks} \xB7 \u5B9E\u4F53 {entities} \xB7 \u5173\u7CFB {relations}",
  manageReindex: "\u91CD\u65B0\u7D22\u5F15",
  manageReindexed: "\u5DF2\u7F6E\u56DE\u5F85\u7D22\u5F15\uFF0C\u540E\u53F0\u5904\u7406\u4E2D",
  manageDisable: "\u505C\u7528",
  manageDisabled: "\u5DF2\u505C\u7528\uFF08\u6570\u636E\u4FDD\u7559\uFF0C\u68C0\u7D22\u6392\u9664\uFF09",
  manageEnable: "\u542F\u7528",
  manageEnabled: "\u5DF2\u542F\u7528\uFF0C\u540E\u53F0\u91CD\u65B0\u7D22\u5F15\u4E2D",
  badgeNote: "\u7B14\u8BB0",
  badgeDisabled: "\u5DF2\u505C\u7528",
  tabRecall: "\u53EC\u56DE\u6D4B\u8BD5",
  recallTitle: "\u53EC\u56DE\u6D4B\u8BD5\uFF08local \u68C0\u7D22\uFF09",
  recallPlaceholder: "\u8F93\u5165\u95EE\u9898\uFF0C\u770B\u8BC1\u636E chunk \u547D\u4E2D\u4E0E\u5206\u6570\u2026",
  recallRun: "\u68C0\u7D22",
  recallHint: "\u5E26\u5206\u6570\u7684\u4E3A FTS \u76F4\u51FB\uFF08bm25\uFF0C\u8D1F\u503C\u66F4\u76F8\u5173\uFF09\uFF1B\u5176\u4F59\u4E3A\u56FE\u8C31\u90BB\u8FD1\u8865\u5145\u3002",
  recallSummary: "\u547D\u4E2D {count} \u4E2A\u8BC1\u636E\u5757 \xB7 \u5173\u8054\u5B9E\u4F53 {entities} \u4E2A",
  recallScore: "\u5206\u6570",
  graphTitle: "\u56FE\u8C31\u89C6\u56FE",
  graphCounts: "\u5168\u5E93\u56FE\u8C31 {nodes} \u8282\u70B9 \xB7 {edges} \u5173\u7CFB\uFF08\u4E0E\u5361\u7247\u5934\u540C\u6E90\uFF09",
  graphFiltered: "\uFF08\u5DF2\u9690\u85CF {n} \u7C7B\uFF09",
  graphHint: "\u6EDA\u8F6E\u7F29\u653E \xB7 \u62D6\u7A7A\u767D\u5E73\u79FB \xB7 \u5355\u51FB\u8282\u70B9\u805A\u7126\u770B\u90BB\u5C45 \xB7 \u5355\u51FB\u8FB9\u770B\u5173\u7CFB \xB7 \u62D6\u8282\u70B9\u8C03\u6574 \xB7 \u56FE\u4F8B\u70B9\u6309\u8FC7\u6EE4 \xB7 \u641C\u7D22\u5B9A\u4F4D",
  graphSearchPlaceholder: "\u641C\u7D22\u5B9E\u4F53\uFF0C\u56FE\u5185\u5B9A\u4F4D\u2026",
  graphSearchEmpty: "\u65E0\u5339\u914D\u5B9E\u4F53",
  graphZoomIn: "\u653E\u5927",
  graphZoomOut: "\u7F29\u5C0F",
  graphFit: "\u9002\u5E94\u89C6\u56FE",
  graphPause: "\u6682\u505C\u5E03\u5C40",
  graphResume: "\u7EE7\u7EED\u5E03\u5C40",
  graphRelayout: "\u91CD\u6392\u5E03\u5C40",
  graphClearSel: "\u6E05\u9664\u805A\u7126",
  graphNeighbors: "\u90BB\u5C45 {n}",
  graphLocate: "\u5DE6\u5217\u5B9A\u4F4D",
  splitDrag: "\u62D6\u52A8\u8C03\u6574\u4E24\u5217\u5BBD\u5EA6",
  mdCopy: "\u590D\u5236",
  mdCopied: "\u5DF2\u590D\u5236",
  mdFootnotes: "\u811A\u6CE8"
};
var en = {
  nav: "Knowledge Graph",
  title: "Knowledge Graph",
  subtitle: "Index authorized corpora into entity-relation-community graphs; agents retrieve via graphrag_* tools.",
  newKb: "New Knowledge Base",
  closeForm: "Close",
  dismiss: "Got it",
  loadFailed: "Load failed",
  empty: 'No knowledge bases yet. Click "New Knowledge Base" to start.',
  formName: "Name",
  formNameHint: "e.g. atlas codebase",
  formRoots: "Authorized directories (one absolute path per line)",
  formRootsHint: "/Users/me/projects/atlas",
  formDesc: "Description (optional)",
  formDescHint: "What this corpus is for",
  create: "Create",
  cancel: "Cancel",
  managedByConfig: "config-managed",
  phaseError: "error",
  phaseDone: "done",
  noRoots: "(no authorized directories)",
  filesIndexed: "Files indexed",
  entities: "Entities",
  relations: "Relations",
  quarantined: "Quarantined",
  lastIndex: "Last index",
  never: "never",
  phaseLabel: "Phase",
  lastReport: "Last: +{added} entities / +{relations} relations / {calls} LLM calls",
  index: "Index",
  cancelIndex: "Cancel",
  delete: "Delete",
  confirmDelete: 'Delete knowledge base "{name}"? Graph data will be removed.',
  channelUnavailable: "The graphrag channel is unavailable",
  createDone: "Created",
  createFailed: "Create failed",
  updateDone: "Updated",
  updateFailed: "Update failed",
  deleteDone: "Deleted",
  deleteFailed: "Delete failed",
  indexStarted: "Indexing started",
  indexFailed: "Index failed to start",
  cancelDone: "Cancellation requested",
  cancelFailed: "Cancel failed",
  tabBrowse: "Browse",
  tabReview: "Accuracy Review",
  tabHealth: "Health Report",
  searchPlaceholder: "Search entities (Enter to run)",
  search: "Search",
  loading: "Loading\u2026",
  noEntities: "No entities matched.",
  reviewHint: "Sample {i}/{n} ({done} done): does this relation hold in the source text?",
  reviewQuestion: "Does the following source text support this relation?",
  confidence: "confidence",
  verdictCorrect: "Correct",
  verdictWrong: "Wrong",
  verdictUnsure: "Unsure",
  resample: "Resample",
  reviewExhausted: "Review round complete ({done} judged). Relations marked wrong are excluded from retrieval.",
  healthTitle: "Health Report",
  coverage: "File coverage",
  stale: "stale",
  samplePrecision: "Sample precision",
  excluded: "Excluded relations",
  healthNote: "Coverage = indexed / scanned files; sample precision comes from human verdicts in Accuracy Review; wrong-marked relations are excluded from retrieval.",
  explore: "Browse / Review",
  closeExplore: "Collapse",
  pickDir: "Pick directory",
  pickUnavailable: "No directory picker is available here \u2014 type an absolute path below instead",
  formWorkspace: "Workspace (delegate target)",
  formWorkspaceFollow: "Follow current session",
  formModel: "Session model (agent chat only)",
  formModelFollow: "Follow session default",
  formModelHint: "Graph extraction model is not picked here: it uses the plugin model config if set, otherwise follows the selected session model automatically",
  agentDelegate: "Agent builds it",
  agentDelegateHint: "No directory at hand? Let an agent scan the current workspace and confirm with you before indexing",
  agentDelegateEmpty: "Let Agent build it",
  agentCreatePrompt: 'Create a knowledge-graph knowledge base and index it.\n- Name: {name}\n- Authorized directories (index only these):\n{roots}\n- Steps: call graphrag_index (kb="{name}", create=true, roots=the directories above); when an approval card appears, confirm with me.\n- Acceptance: use graphrag_status to confirm files indexed > 0, then report entities/relations/communities and quarantined count.\n- Stop: stop right after the status report; do nothing else and modify no files.',
  agentExplorePrompt: "Create a knowledge-graph knowledge base for the current workspace: first inspect the workspace structure, pick directories worth indexing (source/docs; exclude dependency dirs, build output, .git), show me the candidate list with reasons and wait for my confirmation; after I confirm, call graphrag_index (kb + create=true) to build and index, then report the scale via graphrag_status (entities/relations/communities/quarantined). When an approval card appears, explain it before asking for my approval.",
  delegateSubmitted: "Handed to the agent in your conversation \u2014 follow up there for approval and results",
  delegateDraft: "Prompt placed in the conversation composer \u2014 review and press send",
  delegateCopied: "Prompt copied to clipboard \u2014 paste it into the conversation",
  delegateNone: "Could not reach the conversation (clipboard unavailable too)",
  delegateRootsRequired: "Pick or type at least one authorized directory first",
  correctionTitle: "Submit a correction (optional): fix the relation, or just mark it",
  correctionS: "Subject",
  correctionR: "Relation",
  correctionO: "Object",
  correctionSubmit: "Submit correction",
  verdictOnlyWrong: "Mark wrong only",
  verdictOnlyUnsure: "Mark unsure only",
  healthCorrected: "Corrected",
  selCorrect: "Correct from selection",
  selHint: "Select evidence text and click the chip \u2014 fields pre-filled from your selection",
  selNoTriple: "Could not parse a triple from the selection \u2014 fill manually",
  selFailed: "Selection parsing failed",
  tabManage: "Knowledge",
  manageAddTitle: "Add knowledge (paste text; incrementally indexed)",
  manageAddName: "Title",
  manageAddNameHint: "e.g. Liquid-cooling inspection notes (optional; defaults to timestamp)",
  manageAddText: "Body (markdown)",
  manageAddTextHint: "Paste source material; markdown supported. Entities and relations are extracted on indexing",
  manageAddSubmit: "Add & index",
  manageSources: "Indexed sources",
  manageDelete: "Delete",
  manageConfirmDelete: "Delete all graph data for this source? (irreversible)",
  manageNoteAdded: "Added \u2014 indexing in background",
  manageFileDeleted: "Source deleted",
  manageRootsTitle: "Authorized directories (one absolute path per line; click Index to absorb new files)",
  manageRootsSave: "Save directories",
  manageRootsSaved: "Directories updated",
  manageImport: "Import files (pick a directory)",
  manageImported: "Imported {count} files ({skipped} skipped) \u2014 indexing in background",
  manageFilterHint: "Filter by path\u2026",
  manageNoMatch: "No matching sources.",
  manageChanges: "Changes detected: +{added} added / {changed} modified / {removed} deleted",
  manageSyncIndex: "Sync index",
  manageContribution: "C {chunks} \xB7 E {entities} \xB7 R {relations}",
  manageReindex: "Re-index",
  manageReindexed: "Queued for re-index \u2014 processing in background",
  manageDisable: "Disable",
  manageDisabled: "Disabled (data kept, excluded from retrieval)",
  manageEnable: "Enable",
  manageEnabled: "Enabled \u2014 re-indexing in background",
  badgeNote: "note",
  badgeDisabled: "disabled",
  tabRecall: "Recall test",
  recallTitle: "Recall test (local retrieval)",
  recallPlaceholder: "Ask a question to inspect evidence chunks and scores\u2026",
  recallRun: "Search",
  recallHint: "Scored hits are direct FTS matches (bm25, lower is better); the rest are graph-neighbor fills.",
  recallSummary: "{count} evidence chunks \xB7 {entities} related entities",
  recallScore: "score",
  graphTitle: "Graph view",
  graphCounts: "Full graph {nodes} nodes \xB7 {edges} relations (same source as the card header)",
  graphFiltered: "({n} types hidden)",
  graphHint: "Wheel to zoom \xB7 drag background to pan \xB7 click a node to focus and see neighbors \xB7 click an edge to inspect \xB7 drag nodes \xB7 click legend to filter \xB7 search to locate",
  graphSearchPlaceholder: "Search entity to locate\u2026",
  graphSearchEmpty: "No matching entity",
  graphZoomIn: "Zoom in",
  graphZoomOut: "Zoom out",
  graphFit: "Fit view",
  graphPause: "Pause layout",
  graphResume: "Resume layout",
  graphRelayout: "Relayout",
  graphClearSel: "Clear focus",
  graphNeighbors: "{n} neighbors",
  graphLocate: "Locate in list",
  splitDrag: "Drag to resize columns",
  manageEmpty: "No indexed sources yet.",
  mdCopy: "Copy",
  mdCopied: "Copied",
  mdFootnotes: "Footnotes"
};
var dictionaries = { zh, en };

// src/client/bridge.ts
function createHostBridge(ctx) {
  const backToChat = () => {
    try {
      ctx.layout?.selectPanel?.(null);
    } catch {
    }
  };
  const navigateToSession = (target) => {
    const nav = ctx.uiWorkspace?.openSession;
    if (typeof nav === "function") {
      try {
        nav.call(ctx.uiWorkspace, target);
        return;
      } catch {
      }
    }
    try {
      ctx.sessions?.open?.(target);
    } catch {
    }
  };
  const clipboardFallback = async (text) => {
    let copied = false;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText !== void 0) {
        copied = await navigator.clipboard.writeText(text).then(() => true).catch(() => false);
      }
    } catch {
    }
    if (!copied) return "none";
    try {
      const current = ctx.sessions?.list?.getSnapshot?.().current;
      if (current === void 0 && typeof ctx.sessions?.create === "function") {
        await ctx.sessions.create().then((id) => {
          navigateToSession(id);
        }).catch(() => {
        });
      } else if (current !== void 0) {
        navigateToSession(current);
      }
    } catch {
    }
    backToChat();
    return "copied";
  };
  return {
    async pickDirectory() {
      const global = globalThis;
      if (typeof global.__QILIN_DIRECTORY_PICKER__?.pick === "function") {
        try {
          const picked = await global.__QILIN_DIRECTORY_PICKER__.pick();
          return picked !== null && picked !== "" ? picked : null;
        } catch (error) {
          if (ctx.uiWorkspace?.pickDirectory === void 0) throw error;
        }
      }
      if (ctx.uiWorkspace?.pickDirectory !== void 0) {
        return await ctx.uiWorkspace.pickDirectory();
      }
      throw new Error("picker-unavailable");
    },
    listWorkspaces() {
      try {
        const items = ctx.workspaces?.list?.getSnapshot?.().items ?? [];
        return items.map((item) => ({ id: item.workspaceId, title: item.title ?? item.workspaceId }));
      } catch {
        return [];
      }
    },
    async loadModelCatalog() {
      try {
        const catalog = ctx.remote?.session?.modelCatalog;
        if (typeof catalog !== "function") return [];
        const response = await catalog.call(ctx.remote.session);
        if (response?.ok !== true) return [];
        const out = [];
        const groups = response.value.groups;
        if (!Array.isArray(groups)) return [];
        for (const group of groups) {
          const provider = typeof group["id"] === "string" ? group["id"] : void 0;
          const providerName = typeof group["name"] === "string" ? group["name"] : provider;
          const models = Array.isArray(group["models"]) ? group["models"] : [];
          if (provider === void 0 || providerName === void 0) continue;
          for (const model of models) {
            const id = typeof model["id"] === "string" ? model["id"] : void 0;
            const name2 = typeof model["name"] === "string" ? model["name"] : id;
            if (id === void 0 || name2 === void 0) continue;
            out.push({ provider, providerName, model: id, modelName: name2 });
          }
        }
        return out;
      } catch {
        return [];
      }
    },
    async delegate(prompt, options = {}) {
      try {
        const sessions = ctx.sessions;
        if (sessions?.list?.getSnapshot === void 0) return await clipboardFallback(prompt);
        let target = sessions.list.getSnapshot().current ?? null;
        const wantedWorkspace = options.workspaceId;
        if (wantedWorkspace !== void 0) {
          const current = target;
          const currentWorkspace = current !== null ? (ctx.workspaces?.list?.getSnapshot?.().items ?? []).find((item) => item.sessionIds?.includes(current) === true)?.workspaceId : void 0;
          if (currentWorkspace !== wantedWorkspace) {
            if (typeof sessions.create !== "function") return await clipboardFallback(prompt);
            target = await sessions.create({ workspaceId: wantedWorkspace }).catch(() => null);
            if (target === null) return await clipboardFallback(prompt);
          }
        }
        if (target === null) {
          if (typeof sessions.create !== "function") return await clipboardFallback(prompt);
          target = await sessions.create().catch(() => null);
          if (target === null) return await clipboardFallback(prompt);
        }
        backToChat();
        navigateToSession(target);
        if (options.model !== void 0) {
          const directory = ctx.modelDirectories?.directoryFor?.(target);
          if (directory?.select !== void 0) {
            await directory.select(options.model).catch(() => {
            });
          }
        }
        const landed = submitRetained(sessions, target, prompt) ?? await submitWithRetry(sessions, target, prompt);
        if (landed === true) return "submitted";
        if (landed === false) return "draft";
        return await clipboardFallback(prompt);
      } catch {
        return await clipboardFallback(prompt);
      }
    }
  };
}
function submitTo(sessions, sessionId, text) {
  try {
    const actx = sessions.scope?.(sessionId);
    if (actx === void 0) return void 0;
    const conversation = typeof actx.get === "function" ? actx.get("conversation") : void 0;
    const shell = conversation?.input?.for?.(actx);
    if (shell?.setDraft === void 0) return void 0;
    shell.setDraft(text);
    if (typeof shell.submit !== "function") return false;
    shell.submit();
    return true;
  } catch {
    return void 0;
  }
}
function submitRetained(sessions, sessionId, text) {
  if (typeof sessions.retainAgentScope !== "function") return void 0;
  const reference = sessions.retainAgentScope.call(sessions, sessionId);
  try {
    return submitTo(sessions, sessionId, text);
  } finally {
    try {
      reference?.release?.();
    } catch {
    }
  }
}
async function submitWithRetry(sessions, sessionId, text) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const landed = await submitTo(sessions, sessionId, text);
    if (landed !== void 0) return landed;
    await new Promise((resolve) => {
      setTimeout(resolve, 250);
    });
  }
  return void 0;
}

// src/client/protocol.ts
async function unwrap(promise) {
  const raw = await promise;
  if (raw?.ok === true) return raw.value;
  const code = typeof raw?.error?.code === "string" ? raw.error.code : "unknown";
  const message = typeof raw?.error?.message === "string" ? raw.error.message : String(raw?.error?.code ?? "unknown");
  throw Object.assign(new Error(message), { code });
}

// src/client/runtime.ts
var RPC_CHANNEL = "/dsh-kylin-vibe";
function createKbRuntime(deps) {
  let state = { phase: "idle" };
  const listeners = /* @__PURE__ */ new Set();
  const publish = (next) => {
    state = next;
    for (const listener of [...listeners]) listener();
  };
  const source = {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };
  let noticeText;
  const noticeListeners = /* @__PURE__ */ new Set();
  const pushNotice = (text) => {
    noticeText = text;
    for (const l of [...noticeListeners]) l();
  };
  const call = async (endpoint, payload) => unwrap(deps.rpc.call(RPC_CHANNEL, endpoint, payload));
  let pollTimer;
  const hasRunning = () => (state.snapshot?.kbs ?? []).some((kb) => kb.progress !== null && kb.progress.phase !== "done" && kb.progress.phase !== "error");
  const tick = () => {
    void refresh().catch(() => {
    });
  };
  const restartPoll = () => {
    if (pollTimer !== void 0) clearInterval(pollTimer);
    pollTimer = setInterval(tick, hasRunning() ? 1200 : 5e3);
  };
  async function refresh() {
    if (state.phase === "idle" || state.phase === "error") publish({ ...state, phase: state.phase === "error" ? "error" : "loading" });
    try {
      const snapshot = await call("snapshot", {});
      const runningBefore = hasRunning();
      publish({ phase: "ready", snapshot, refreshedAt: Date.now() });
      if (hasRunning() !== runningBefore) restartPoll();
    } catch (error) {
      publish({ phase: "error", error: error instanceof Error ? error.message : String(error) });
    }
  }
  const withRefresh = async (action, done, failed) => {
    try {
      await action();
      pushNotice(done);
      await refresh();
    } catch (error) {
      pushNotice(`${failed}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  const runtime = {
    rpc: deps.rpc,
    source,
    notice: {
      getSnapshot: () => noticeText,
      subscribe: (listener) => {
        noticeListeners.add(listener);
        return () => {
          noticeListeners.delete(listener);
        };
      }
    },
    pushNotice,
    dismissNotice: () => {
      noticeText = void 0;
      for (const l of [...noticeListeners]) l();
    },
    refresh,
    start: () => {
      void refresh();
      restartPoll();
    },
    stop: () => {
      if (pollTimer !== void 0) {
        clearInterval(pollTimer);
        pollTimer = void 0;
      }
    },
    create: (input) => withRefresh(() => call("createKb", input), `\u77E5\u8BC6\u5E93\u300C${input.name}\u300D\u5DF2\u521B\u5EFA`, "\u521B\u5EFA\u5931\u8D25"),
    update: (input) => withRefresh(() => call("updateKb", input), "\u77E5\u8BC6\u5E93\u5DF2\u66F4\u65B0", "\u66F4\u65B0\u5931\u8D25"),
    remove: (id) => withRefresh(() => call("deleteKb", { id }), "\u77E5\u8BC6\u5E93\u5DF2\u5220\u9664", "\u5220\u9664\u5931\u8D25"),
    startIndex: (id, retryQuarantined = false) => withRefresh(
      () => call("index", { id, retryQuarantined }),
      "\u7D22\u5F15\u5DF2\u542F\u52A8",
      "\u7D22\u5F15\u542F\u52A8\u5931\u8D25"
    ),
    cancel: (id) => withRefresh(() => call("cancel", { id }), "\u5DF2\u8BF7\u6C42\u53D6\u6D88", "\u53D6\u6D88\u5931\u8D25")
  };
  return runtime;
}
function sortKbs(kbs) {
  return [...kbs].sort((a, b) => (b.lastIndexedAt ?? 0) - (a.lastIndexedAt ?? 0) || a.name.localeCompare(b.name));
}

// src/client/styles.ts
var STYLE_ID = "ky-graphrag-styles";
function installStyles() {
  if (document.getElementById(STYLE_ID) !== null) return () => {
  };
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
  return () => {
    style.remove();
  };
}
var CSS = `
.gv-panel, .gv-form, .gv-card {
  --gv-fg: var(--dsw-alias-label-primary, #1f2329);
  --gv-fg-secondary: var(--dsw-alias-label-secondary, #5a6472);
  --gv-fg-muted: var(--dsw-alias-label-tertiary, #8a94a3);
  --gv-layer: var(--dsw-alias-bg-layer-2, transparent);
  --gv-fill: var(--dsw-alias-bg-skeleton, rgba(127,127,127,.14));
  --gv-border: var(--dsw-alias-border-l3, rgba(127,127,127,.3));
  --gv-primary: var(--dsw-alias-brand-primary-new-colorprimary-new-color, #4176e6);
  --gv-primary-fg: var(--dsw-alias-label-primary-foreground, #ffffff);
  --gv-error: var(--dsw-alias-state-error-primary, #d0403d);
}
.gv-panel { height: 100%; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 16px 20px 32px; box-sizing: border-box; font-size: 13px; line-height: 1.5; color: var(--gv-fg); }
.gv-panel h2 { margin: 0 0 4px; font-size: 16px; color: var(--gv-fg); }
.gv-sub { color: var(--gv-fg-secondary); margin: 0 0 12px; }
.gv-notice { background: color-mix(in srgb, var(--gv-primary) 12%, transparent); border-radius: 8px; padding: 8px 12px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.gv-card { border: 1px solid var(--gv-border); border-radius: 10px; padding: 12px 14px; margin-bottom: 10px; background: var(--gv-layer); }
.gv-card-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
.gv-name { font-weight: 600; font-size: 14px; color: var(--gv-fg); }
.gv-badge { font-size: 11px; padding: 1px 8px; border-radius: 999px; background: var(--gv-fill); color: var(--gv-fg-secondary); }
.gv-roots { color: var(--gv-fg-muted); font-size: 12px; word-break: break-all; margin: 4px 0; }
.gv-stats { display: flex; flex-wrap: wrap; gap: 12px; margin: 8px 0; color: var(--gv-fg-muted); font-size: 12px; }
.gv-actions { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
.gv-actions + .gv-actions { margin-top: 10px; }
.gv-actions { row-gap: 6px; }
.gv-btn { border: 1px solid var(--gv-border); background: transparent; color: var(--gv-fg); border-radius: 8px; padding: 4px 12px; cursor: pointer; font-size: 12px; }
.gv-btn:hover { background: var(--gv-fill); }
.gv-btn:disabled { opacity: .45; cursor: not-allowed; }
.gv-btn-primary { background: var(--gv-primary); border-color: var(--gv-primary); color: var(--gv-primary-fg); }
.gv-btn-danger { color: var(--gv-error); border-color: color-mix(in srgb, var(--gv-error) 50%, transparent); }
.gv-bar { height: 6px; border-radius: 3px; background: var(--gv-fill); overflow: hidden; margin: 6px 0; }
.gv-bar-fill { height: 100%; background: var(--gv-primary); transition: width .4s; }
.gv-current { font-size: 11px; color: var(--gv-fg-muted); word-break: break-all; }
.gv-form { border: 1px dashed var(--gv-border); border-radius: 10px; padding: 12px 14px; margin-bottom: 12px; }
.gv-form label, .gv-card label { display: block; margin: 8px 0 4px; font-size: 12px; color: var(--gv-fg-secondary); }
.gv-form input, .gv-card input, .gv-form textarea, .gv-card textarea, .gv-search input { width: 100%; box-sizing: border-box; border: 1px solid var(--gv-border); border-radius: 8px; padding: 6px 8px; background: transparent; color: var(--gv-fg); font-size: 13px; font-family: inherit; }
.gv-select { width: 100%; box-sizing: border-box; border: 1px solid var(--gv-border); border-radius: 8px; padding: 6px 8px; background: transparent; color: var(--gv-fg); font-size: 12px; font-family: inherit; }
.gv-select option { color: #1f2329; background: #fff; }
.gv-form textarea, .gv-card textarea { min-height: 56px; resize: vertical; }
.gv-error { color: var(--gv-error); margin: 10px 0; }
.gv-empty { color: var(--gv-fg-muted); padding: 24px 0; text-align: center; }
.gv-cost { font-size: 11px; color: var(--gv-fg-muted); }
.gv-tabs { display: flex; gap: 6px; margin-top: 8px; margin-bottom: 10px; flex-wrap: wrap; }
.gv-tab-active { background: color-mix(in srgb, var(--gv-primary) 15%, transparent); border-color: var(--gv-primary); }
.gv-search { display: flex; gap: 8px; margin-bottom: 10px; }
.gv-search input { flex: 1; }
.gv-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px; }
.gv-table td { padding: 3px 8px 3px 0; border-top: 1px solid var(--gv-border); color: var(--gv-fg); }
.gv-evidence { margin: 6px 0; }
.gv-md { max-height: 420px; overflow-y: auto; font-size: 12px; }
.gv-selchip { position: fixed; z-index: 90; box-shadow: 0 4px 14px rgba(0,0,0,.25); }
.gv-pre { background: var(--gv-fill); border-radius: 8px; padding: 8px; font-size: 11px; overflow-x: auto; white-space: pre-wrap; word-break: break-all; color: var(--gv-fg); }
.gv-split { display: flex; gap: 6px; align-items: flex-start; }
.gv-split-left { flex: 1 1 0; min-width: 0; }
.gv-split-divider { flex: 0 0 6px; align-self: stretch; cursor: col-resize; border-radius: 3px; background: transparent; touch-action: none; }
.gv-split-divider:hover, .gv-split-divider[data-drag='1'] { background: var(--gv-fill); }
.gv-split-right { flex: 0 0 44%; position: sticky; top: 0; min-width: 280px; }
.gv-graph { border: 1px solid var(--gv-border); border-radius: 10px; background: rgba(127,127,127,.05); height: 78vh; max-height: 860px; min-height: 420px; position: relative; overflow: hidden; }
.gv-graph canvas { display: block; cursor: grab; }
.gv-graph-head { position: absolute; top: 8px; left: 10px; right: 10px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; z-index: 5; pointer-events: none; }
.gv-graph-head .gv-name { font-size: 12px; }
.gv-graph-head .gv-actions, .gv-graph-head .gv-graph-search { pointer-events: auto; }
.gv-graph-head .gv-actions { margin: 0 0 0 auto; flex-wrap: wrap; }
.gv-graph-head .gv-btn { padding: 1px 8px; font-size: 11px; }
.gv-graph-search { position: relative; }
.gv-graph-search input { width: 160px; padding: 2px 8px; font-size: 11px; border-radius: 999px; }
.gv-graph-searchlist { position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 6; background: var(--dsw-alias-bg-layer-3, #fff); border: 1px solid var(--gv-border); border-radius: 8px; max-height: 200px; overflow-y: auto; box-shadow: 0 4px 14px rgba(0,0,0,.15); }
.gv-graph-searchlist button { display: block; width: 100%; text-align: left; padding: 4px 8px; background: transparent; border: none; cursor: pointer; color: #1f2329; font-size: 11px; }
.gv-graph-searchlist button:hover { background: rgba(127,127,127,.14); }
.gv-graph-search-empty { display: block; padding: 6px 8px; font-size: 11px; color: #5a6472; }
.gv-legend { position: absolute; top: 30px; left: 10px; display: flex; flex-wrap: wrap; gap: 4px 10px; font-size: 10.5px; color: var(--gv-fg-muted); max-width: 70%; z-index: 2; align-items: center; }
.gv-legend button { display: inline-flex; align-items: center; border: none; background: transparent; color: inherit; font: inherit; padding: 0; cursor: pointer; }
.gv-legend button:hover { color: var(--gv-fg); }
.gv-legend button.gv-legend-off { opacity: .35; text-decoration: line-through; }
.gv-legend i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; }
.gv-graph-tip { position: absolute; z-index: 6; max-width: 340px; background: rgba(22,24,29,.92); color: #f2f4f7; font-size: 11px; line-height: 1.4; padding: 5px 8px; border-radius: 6px; pointer-events: none; box-shadow: 0 2px 8px rgba(0,0,0,.25); word-break: break-all; }
.gv-graph-card { position: absolute; top: 56px; right: 10px; width: 250px; max-height: 58%; display: flex; flex-direction: column; border: 1px solid var(--gv-border); border-radius: 10px; background: var(--dsw-alias-bg-layer-3, var(--dsw-alias-bg-layer-2, rgba(127,127,127,.08))); box-shadow: 0 4px 14px rgba(0,0,0,.15); z-index: 4; font-size: 12px; }
.gv-graph-card-head { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding: 8px 10px 6px; border-bottom: 1px solid var(--gv-border); }
.gv-graph-card-tools { margin-left: auto; display: flex; gap: 4px; }
.gv-graph-card-tools .gv-btn { padding: 0 6px; font-size: 12px; line-height: 1.4; }
.gv-graph-card-body { overflow-y: auto; padding: 6px 8px 8px; }
.gv-graph-card-row { display: flex; align-items: baseline; gap: 6px; width: 100%; text-align: left; border: none; background: transparent; color: var(--gv-fg); padding: 3px 4px; border-radius: 6px; cursor: pointer; font-size: 12px; font-family: inherit; }
.gv-graph-card-row:hover { background: var(--gv-fill); }
.gv-graph-card-row:disabled { cursor: default; opacity: .5; }
.gv-graph-card-row span:nth-child(3) { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gv-graph-ctl { position: absolute; right: 10px; bottom: 26px; display: flex; flex-direction: column; gap: 4px; z-index: 3; }
.gv-graph-ctl .gv-btn { padding: 0 8px; font-size: 13px; line-height: 1.5; background: var(--gv-layer); }
.gv-graph-hint { position: absolute; bottom: 6px; right: 10px; font-size: 10px; color: var(--gv-fg-muted); pointer-events: none; }
`;

// src/client/view.tsx
var import_react2 = require("react");

// src/client/browse-review.tsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var markdownTextCache = null;
function markdownTextOf() {
  if (markdownTextCache !== null) return markdownTextCache;
  try {
    const mod = typeof __bundleRequire === "function" ? __bundleRequire("@deepseek-ai/dsh-client-ui-primitives") : void 0;
    const mt = mod?.MarkdownText;
    markdownTextCache = mt !== null && mt !== void 0 && (typeof mt === "function" || typeof mt === "object") ? mt : void 0;
  } catch {
    markdownTextCache = void 0;
  }
  return markdownTextCache;
}
function ChunkText(props) {
  const Markdown = markdownTextOf();
  if (Markdown === void 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", { className: "gv-pre", children: props.text });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gv-pre gv-md", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    Markdown,
    {
      text: props.text,
      labels: { code: { copyLabel: props.t("mdCopy"), copiedLabel: props.t("mdCopied") }, footnotes: props.t("mdFootnotes") },
      variant: "compact"
    }
  ) });
}
function BrowseReviewView(props) {
  const { runtime, t, kbId, roots } = props;
  const [tab, setTab] = (0, import_react.useState)("browse");
  const tabs = [
    { kind: "browse", label: t("tabBrowse") },
    { kind: "review", label: t("tabReview") },
    { kind: "recall", label: t("tabRecall") },
    { kind: "health", label: t("tabHealth") },
    { kind: "manage", label: t("tabManage") }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gv-tabs", children: tabs.map((x) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: tab === x.kind ? "gv-btn gv-tab-active" : "gv-btn", onClick: () => setTab(x.kind), children: x.label }, x.kind)) }),
    tab === "browse" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BrowseTab, { runtime, t, kbId }),
    tab === "review" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReviewTab, { runtime, t, kbId }),
    tab === "recall" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RecallTab, { runtime, t, kbId }),
    tab === "health" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HealthTab, { runtime, t, kbId }),
    tab === "manage" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ManageTab, { runtime, t, kbId, roots })
  ] });
}
function RecallTab(props) {
  const { runtime, t, kbId } = props;
  const [question, setQuestion] = (0, import_react.useState)("");
  const [topK, setTopK] = (0, import_react.useState)(12);
  const [pack, setPack] = (0, import_react.useState)(null);
  const [busy, setBusy] = (0, import_react.useState)(false);
  const run = (q) => {
    if (q.trim() === "") return;
    setBusy(true);
    setPack(null);
    void unwrap(runtime.rpc.call(RPC_CHANNEL, "recall", { id: kbId, question: q.trim(), topK })).then((v) => {
      const pack2 = v;
      setPack({ chunks: pack2.chunks ?? [], entities: pack2.entities?.length ?? 0 });
    }).catch((err) => runtime.pushNotice(`${t("loadFailed")}: ${err instanceof Error ? err.message : String(err)}`)).finally(() => setBusy(false));
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gv-card-head", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gv-name", children: t("recallTitle") }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-search", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            value: question,
            placeholder: t("recallPlaceholder"),
            onChange: (e) => setQuestion(e.target.value),
            onKeyDown: (e) => {
              if (e.key === "Enter") run(question);
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", { className: "gv-select", style: { width: 90 }, value: topK, onChange: (e) => setTopK(Number(e.target.value)), children: [5, 10, 12, 20, 30, 50].map((k) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", { value: k, children: [
          "top ",
          k
        ] }, k)) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "gv-btn gv-btn-primary", disabled: busy || question.trim() === "", onClick: () => run(question), children: t("recallRun") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gv-cost", children: t("recallHint") })
    ] }),
    busy && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gv-empty", children: t("loading") }),
    pack !== null && !busy && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gv-cost", style: { marginBottom: 6 }, children: t("recallSummary", { count: pack.chunks.length, entities: pack.entities }) }),
      pack.chunks.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gv-empty", children: t("noEntities") }),
      pack.chunks.map((c, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-card", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-card-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "gv-cost", style: { wordBreak: "break-all" }, children: [
            c.path,
            ":",
            c.lines
          ] }),
          c.score !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "gv-badge", children: [
            t("recallScore"),
            " ",
            c.score.toFixed(3)
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChunkText, { text: c.text, t })
      ] }, i))
    ] })
  ] });
}
function BrowseTab(props) {
  const { runtime, t, kbId } = props;
  const [query, setQuery] = (0, import_react.useState)("");
  const [cards, setCards] = (0, import_react.useState)([]);
  const [loading, setLoading] = (0, import_react.useState)(true);
  const load = (q) => {
    setLoading(true);
    void unwrap(runtime.rpc.call(RPC_CHANNEL, "browse", { id: kbId, query: q, limit: 30 })).then((v) => setCards(v)).catch((err) => runtime.pushNotice(`${t("loadFailed")}: ${err instanceof Error ? err.message : String(err)}`)).finally(() => setLoading(false));
  };
  (0, import_react.useEffect)(() => {
    load("");
  }, [kbId]);
  const [rightPct, setRightPct] = (0, import_react.useState)(() => {
    try {
      const stored = Number(window.localStorage.getItem("gv-split-right-pct"));
      if (Number.isFinite(stored) && stored >= 20 && stored <= 75) return stored;
    } catch {
    }
    return 44;
  });
  const [dividerDrag, setDividerDrag] = (0, import_react.useState)(false);
  const splitRef = (0, import_react.useRef)(null);
  const rightPctRef = (0, import_react.useRef)(rightPct);
  const dividerDown = (e) => {
    e.preventDefault();
    setDividerDrag(true);
    rightPctRef.current = rightPct;
    e.target.setPointerCapture?.(e.pointerId);
    document.body.style.userSelect = "none";
  };
  const dividerMove = (e) => {
    if (!dividerDrag) return;
    const rect = splitRef.current?.getBoundingClientRect();
    if (rect === void 0 || rect === null || rect.width === 0) return;
    const pct = Math.max(20, Math.min(75, (rect.right - e.clientX) / rect.width * 100));
    rightPctRef.current = pct;
    setRightPct(pct);
  };
  const dividerUp = () => {
    if (!dividerDrag) return;
    setDividerDrag(false);
    document.body.style.userSelect = "";
    try {
      window.localStorage.setItem("gv-split-right-pct", String(rightPctRef.current));
    } catch {
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-split", ref: splitRef, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-split-left", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-search", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            value: query,
            placeholder: t("searchPlaceholder"),
            onChange: (e) => setQuery(e.target.value),
            onKeyDown: (e) => {
              if (e.key === "Enter") load(query);
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "gv-btn", onClick: () => load(query), children: t("search") })
      ] }),
      loading && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gv-empty", children: t("loading") }),
      !loading && cards.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gv-empty", children: t("noEntities") }),
      cards.map((card) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { id: `gv-card-${card.id}`, className: "gv-card", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-card-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gv-name", children: card.name }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gv-badge", children: card.type }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "gv-badge", children: [
            "deg ",
            card.degree
          ] })
        ] }),
        card.description !== null && card.description !== "" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: card.description }),
        card.neighbors.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("table", { className: "gv-table", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: card.neighbors.map((nb, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: nb.dir === "out" ? "\u2192" : "\u2190" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: nb.type }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: nb.other }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", { className: "gv-cost", children: [
            "w=",
            nb.weight,
            nb.evidence.length > 0 ? ` \xB7 ${nb.evidence[0]?.path}:${nb.evidence[0]?.lines}` : ""
          ] })
        ] }, i)) }) })
      ] }, card.id))
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        className: "gv-split-divider",
        "data-drag": dividerDrag ? "1" : "0",
        title: t("splitDrag"),
        onPointerDown: dividerDown,
        onPointerMove: dividerMove,
        onPointerUp: dividerUp
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gv-split-right", style: { flex: `0 0 ${rightPct}%` }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GraphView, { t, runtime, kbId }) })
  ] });
}
var TYPE_COLORS = {
  module: "#4b7bec",
  file: "#a55eea",
  function: "#26de81",
  class: "#fd9644",
  type: "#fc5c65",
  concept: "#45aaf2",
  config: "#a5b1c2",
  cli: "#6ab04c",
  api: "#e84393",
  external_dependency: "#eb3b5a",
  test: "#2bcbba"
};
function typeColor(t) {
  return TYPE_COLORS[t] ?? "#8892a0";
}
var LAYOUT_K = 40;
var CONTACT_F = 100;
var SPRING_STIFF = 0.05;
var SPRING_REST = LAYOUT_K * 1.6;
var GRAVITY = 3e-3;
var MOVE_CAP = 30;
var FOCUS_COLOR = "#4176e6";
function seedPositions(nodes) {
  const order = [...nodes].sort((a, b) => b.degree - a.degree);
  const golden = Math.PI * (3 - Math.sqrt(5));
  order.forEach((node, i) => {
    const r = LAYOUT_K * 0.62 * Math.sqrt(i + 0.6);
    const th = i * golden;
    node.x = r * Math.cos(th);
    node.y = r * Math.sin(th);
  });
}
function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const u = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - (ax + u * dx), py - (ay + u * dy));
}
function GraphView(props) {
  const { t, runtime, kbId } = props;
  const [data, setData] = (0, import_react.useState)(null);
  const [loadErr, setLoadErr] = (0, import_react.useState)(null);
  const [selId, setSelId] = (0, import_react.useState)(null);
  const [selEdge, setSelEdge] = (0, import_react.useState)(null);
  const [hiddenTypes, setHiddenTypes] = (0, import_react.useState)(/* @__PURE__ */ new Set());
  const [hoverTip, setHoverTip] = (0, import_react.useState)(null);
  const [layoutPaused, setLayoutPaused] = (0, import_react.useState)(false);
  const [search, setSearch] = (0, import_react.useState)("");
  const [canLocate, setCanLocate] = (0, import_react.useState)(false);
  const wrapRef = (0, import_react.useRef)(null);
  const canvasRef = (0, import_react.useRef)(null);
  const dataRef = (0, import_react.useRef)(null);
  const viewRef = (0, import_react.useRef)({ x: 0, y: 0, k: 1 });
  const alphaRef = (0, import_react.useRef)(0);
  const dirtyRef = (0, import_react.useRef)(true);
  const pausedRef = (0, import_react.useRef)(false);
  const userMovedRef = (0, import_react.useRef)(false);
  const hoverNodeRef = (0, import_react.useRef)(null);
  const hoverEdgeRef = (0, import_react.useRef)(null);
  const selRef = (0, import_react.useRef)(null);
  const selEdgeRef = (0, import_react.useRef)(null);
  const hiddenRef = (0, import_react.useRef)(/* @__PURE__ */ new Set());
  const fgRef = (0, import_react.useRef)("#d7dce2");
  const tipKeyRef = (0, import_react.useRef)("");
  const frameRef = (0, import_react.useRef)(0);
  const rafRef = (0, import_react.useRef)(0);
  const dragRef = (0, import_react.useRef)({ mode: "idle", id: null, sx: 0, sy: 0, ox: 0, oy: 0, moved: false });
  const index = (0, import_react.useMemo)(() => {
    if (data === null) return null;
    const byId = /* @__PURE__ */ new Map();
    for (const n of data.nodes) byId.set(n.id, n);
    const adj = /* @__PURE__ */ new Map();
    for (const e of data.edges) {
      let la = adj.get(e.s);
      if (la === void 0) {
        la = [];
        adj.set(e.s, la);
      }
      let lb = adj.get(e.t);
      if (lb === void 0) {
        lb = [];
        adj.set(e.t, lb);
      }
      la.push({ edge: e, other: e.t });
      lb.push({ edge: e, other: e.s });
    }
    const hubs = [...data.nodes].sort((a, b) => b.degree - a.degree);
    return { byId, adj, hubs };
  }, [data]);
  const indexRef = (0, import_react.useRef)(index);
  indexRef.current = index;
  const applySel = (id) => {
    selRef.current = id;
    setSelId(id);
    dirtyRef.current = true;
  };
  const applySelEdge = (i) => {
    selEdgeRef.current = i;
    setSelEdge(i);
    dirtyRef.current = true;
  };
  const applyHidden = (next) => {
    hiddenRef.current = next;
    setHiddenTypes(next);
    dirtyRef.current = true;
  };
  (0, import_react.useEffect)(() => {
    let alive = true;
    void unwrap(runtime.rpc.call(RPC_CHANNEL, "graphAll", { id: kbId })).then((v) => {
      if (!alive) return;
      const r = v;
      const nodes = r.nodes.map((n) => ({ id: n.id, name: n.name, type: n.type, degree: n.degree, x: 0, y: 0 }));
      const edges = r.edges.map((e) => ({ s: e.s, t: e.t, type: e.type, weight: e.weight }));
      seedPositions(nodes);
      dataRef.current = { nodes, edges };
      setData(dataRef.current);
      alphaRef.current = 1;
      frameRef.current = 0;
      userMovedRef.current = false;
      applySel(null);
      applySelEdge(null);
      applyHidden(/* @__PURE__ */ new Set());
    }).catch((err) => {
      if (alive) setLoadErr(String(err));
    });
    return () => {
      alive = false;
    };
  }, [kbId]);
  (0, import_react.useEffect)(() => {
    if (selId === null) {
      setCanLocate(false);
      return;
    }
    setCanLocate(document.getElementById(`gv-card-${selId}`) !== null);
  }, [selId]);
  const fitToView = (stick) => {
    const d = dataRef.current;
    const wrap = wrapRef.current;
    if (d === null || wrap === null || d.nodes.length === 0) return;
    const rect = wrap.getBoundingClientRect();
    const W = Math.max(rect.width, 60);
    const H = Math.max(rect.height, 60);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of d.nodes) {
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x > maxX) maxX = n.x;
      if (n.y > maxY) maxY = n.y;
    }
    const bw = Math.max(maxX - minX, LAYOUT_K);
    const bh = Math.max(maxY - minY, LAYOUT_K);
    const k = Math.max(0.04, Math.min(2.5, Math.min((W - 48) / bw, (H - 48) / bh)));
    viewRef.current = { k, x: W / 2 - (minX + bw / 2) * k, y: H / 2 - (minY + bh / 2) * k };
    if (stick) userMovedRef.current = true;
    dirtyRef.current = true;
  };
  const zoomStep = (factor) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    const cx = (rect?.width ?? 600) / 2;
    const cy = (rect?.height ?? 400) / 2;
    const v = viewRef.current;
    const k = Math.max(0.04, Math.min(4, v.k * factor));
    viewRef.current = { k, x: cx - (cx - v.x) * k / v.k, y: cy - (cy - v.y) * k / v.k };
    userMovedRef.current = true;
    dirtyRef.current = true;
  };
  const locateNode = (node) => {
    applySel(node.id);
    applySelEdge(null);
    const rect = wrapRef.current?.getBoundingClientRect();
    const v = viewRef.current;
    const k = Math.max(v.k, 1);
    viewRef.current = { k, x: (rect?.width ?? 600) / 2 - node.x * k, y: (rect?.height ?? 400) / 2 - node.y * k };
    userMovedRef.current = true;
    dirtyRef.current = true;
  };
  const toggleType = (type) => {
    const next = new Set(hiddenRef.current);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    applyHidden(next);
  };
  const layoutStep = (d) => {
    const nodes = d.nodes;
    const n = nodes.length;
    if (n === 0) {
      alphaRef.current = 0;
      return;
    }
    const cell = /* @__PURE__ */ new Map();
    nodes.forEach((node, i) => {
      const key = Math.floor(node.x / LAYOUT_K) * 131072 + Math.floor(node.y / LAYOUT_K);
      let list = cell.get(key);
      if (list === void 0) {
        list = [];
        cell.set(key, list);
      }
      list.push(i);
    });
    const dispX = new Float64Array(n);
    const dispY = new Float64Array(n);
    const indexBy = /* @__PURE__ */ new Map();
    nodes.forEach((node, i) => indexBy.set(node.id, i));
    for (let i = 0; i < n; i++) {
      const a = nodes[i];
      const gx = Math.floor(a.x / LAYOUT_K);
      const gy = Math.floor(a.y / LAYOUT_K);
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          const list = cell.get((gx + ox) * 131072 + (gy + oy));
          if (list === void 0) continue;
          for (const j of list) {
            if (j <= i) continue;
            const b = nodes[j];
            let dx = a.x - b.x;
            let dy = a.y - b.y;
            let dist = Math.hypot(dx, dy);
            if (dist < 1e-6) {
              const ang = (i * 2.399963 + j) % (Math.PI * 2);
              dx = Math.cos(ang);
              dy = Math.sin(ang);
              dist = 1;
            }
            const f = dist < LAYOUT_K ? CONTACT_F * (2 * LAYOUT_K - dist) / LAYOUT_K : LAYOUT_K * LAYOUT_K / (dist * dist);
            const ux = dx / dist;
            const uy = dy / dist;
            dispX[i] += ux * f;
            dispY[i] += uy * f;
            dispX[j] -= ux * f;
            dispY[j] -= uy * f;
          }
        }
      }
    }
    for (const e of d.edges) {
      const ia = indexBy.get(e.s);
      const ib = indexBy.get(e.t);
      if (ia === void 0 || ib === void 0) continue;
      const a = nodes[ia];
      const b = nodes[ib];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.max(Math.hypot(dx, dy), 1);
      const f = (dist - SPRING_REST) * SPRING_STIFF;
      const ux = dx / dist;
      const uy = dy / dist;
      dispX[ia] -= ux * f;
      dispY[ia] -= uy * f;
      dispX[ib] += ux * f;
      dispY[ib] += uy * f;
    }
    const pinnedId = dragRef.current.id;
    for (let i = 0; i < n; i++) {
      const node = nodes[i];
      dispX[i] -= node.x * GRAVITY;
      dispY[i] -= node.y * GRAVITY;
      const mag = Math.hypot(dispX[i], dispY[i]);
      if (mag < 1e-9) continue;
      const limit = Math.min(mag, MOVE_CAP) * alphaRef.current;
      if (pinnedId !== node.id) {
        node.x += dispX[i] / mag * limit;
        node.y += dispY[i] / mag * limit;
      }
    }
    alphaRef.current = alphaRef.current < 0.02 ? 0 : alphaRef.current * 0.996;
  };
  const draw = (wrap) => {
    const canvas = canvasRef.current;
    const d = dataRef.current;
    const idx = indexRef.current;
    if (canvas === null || d === null || idx === null) return;
    const rect = wrap.getBoundingClientRect();
    const W = Math.max(rect.width, 60);
    const H = Math.max(rect.height, 60);
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
    }
    const ctx = canvas.getContext("2d");
    if (ctx === null) return;
    const view = viewRef.current;
    const hidden = hiddenRef.current;
    const sel = selRef.current;
    const selE = selEdgeRef.current;
    const activeEdge = hoverEdgeRef.current ?? selE;
    let focus = null;
    let focusEdges = null;
    if (sel !== null) {
      focus = /* @__PURE__ */ new Set([sel]);
      focusEdges = /* @__PURE__ */ new Set();
      for (const link of idx.adj.get(sel) ?? []) {
        focus.add(link.other);
        focusEdges.add(link.edge);
      }
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const wx0 = -view.x / view.k - 60;
    const wy0 = -view.y / view.k - 60;
    const wx1 = (W - view.x) / view.k + 60;
    const wy1 = (H - view.y) / view.k + 60;
    const on = (n) => !hidden.has(n.type) && n.x >= wx0 && n.x <= wx1 && n.y >= wy0 && n.y <= wy1;
    const edgeEnds = (i) => {
      if (i === null) return null;
      const e = d.edges[i];
      if (e === void 0) return null;
      const a = idx.byId.get(e.s);
      const b = idx.byId.get(e.t);
      if (a === void 0 || b === void 0) return null;
      return { a, b, e };
    };
    const arrow = (a, b) => {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(Math.hypot(dx, dy), 1);
      const ux = dx / dist;
      const uy = dy / dist;
      const rB = nodeR(b);
      const ax = b.x - ux * (rB + 2);
      const ay = b.y - uy * (rB + 2);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax - ux * 5 - uy * 2.4, ay - uy * 5 + ux * 2.4);
      ctx.lineTo(ax - ux * 5 + uy * 2.4, ay - uy * 5 - ux * 2.4);
      ctx.closePath();
      ctx.fill();
    };
    ctx.save();
    ctx.translate(view.x, view.y);
    ctx.scale(view.k, view.k);
    ctx.lineWidth = 1 / view.k;
    ctx.strokeStyle = focus !== null ? "rgba(128,138,152,0.08)" : "rgba(128,138,152,0.32)";
    ctx.beginPath();
    for (const e of d.edges) {
      if (focusEdges !== null && focusEdges.has(e)) continue;
      const a = idx.byId.get(e.s);
      const b = idx.byId.get(e.t);
      if (a === void 0 || b === void 0 || hidden.has(a.type) || hidden.has(b.type)) continue;
      const aIn = a.x >= wx0 && a.x <= wx1 && a.y >= wy0 && a.y <= wy1;
      const bIn = b.x >= wx0 && b.x <= wx1 && b.y >= wy0 && b.y <= wy1;
      if (!aIn && !bIn) continue;
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
    ctx.strokeStyle = FOCUS_COLOR;
    ctx.lineWidth = 1.6 / view.k;
    ctx.beginPath();
    for (const e of focusEdges ?? []) {
      const a = idx.byId.get(e.s);
      const b = idx.byId.get(e.t);
      if (a === void 0 || b === void 0) continue;
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    if (activeEdge !== null) {
      const ends = edgeEnds(activeEdge);
      if (ends !== null) {
        ctx.moveTo(ends.a.x, ends.a.y);
        ctx.lineTo(ends.b.x, ends.b.y);
      }
    }
    ctx.stroke();
    ctx.fillStyle = FOCUS_COLOR;
    for (const e of focusEdges ?? []) {
      const a = idx.byId.get(e.s);
      const b = idx.byId.get(e.t);
      if (a !== void 0 && b !== void 0) arrow(a, b);
    }
    if (activeEdge !== null) {
      const ends = edgeEnds(activeEdge);
      if (ends !== null && (focusEdges === null || !focusEdges.has(ends.e))) arrow(ends.a, ends.b);
    }
    if (view.k > 1.6) {
      ctx.fillStyle = "rgba(128,138,152,0.6)";
      for (const e of d.edges) {
        if (focusEdges !== null && focusEdges.has(e)) continue;
        const a = idx.byId.get(e.s);
        const b = idx.byId.get(e.t);
        if (a === void 0 || b === void 0 || hidden.has(a.type) || hidden.has(b.type)) continue;
        if (!on(a) && !on(b)) continue;
        arrow(a, b);
      }
    }
    const drawNodes = (dim) => {
      const batch = /* @__PURE__ */ new Map();
      for (const node of d.nodes) {
        if (!on(node)) continue;
        const isDim = focus !== null && !focus.has(node.id);
        if (isDim !== dim) continue;
        let list = batch.get(node.type);
        if (list === void 0) {
          list = [];
          batch.set(node.type, list);
        }
        list.push(node);
      }
      for (const [type, list] of batch) {
        ctx.fillStyle = typeColor(type);
        ctx.beginPath();
        for (const node of list) {
          const r = nodeR(node);
          ctx.moveTo(node.x + r, node.y);
          ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        }
        ctx.fill();
      }
    };
    ctx.globalAlpha = 0.12;
    drawNodes(true);
    ctx.globalAlpha = 1;
    drawNodes(false);
    ctx.lineWidth = 1.6 / view.k;
    for (const node of d.nodes) {
      const isHot = hoverNodeRef.current === node.id;
      const isSel = sel === node.id;
      if (!isHot && !isSel) continue;
      ctx.strokeStyle = isSel ? FOCUS_COLOR : "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeR(node) + 2.5 / view.k, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    const fg = fgRef.current;
    const hubN = view.k >= 1 ? Number.POSITIVE_INFINITY : view.k >= 0.55 ? 60 : 18;
    let labeled = 0;
    for (const node of idx.hubs) {
      const isHot = hoverNodeRef.current === node.id || sel === node.id;
      if (hidden.has(node.type)) continue;
      const sx = node.x * view.k + view.x;
      const sy = node.y * view.k + view.y;
      if (sx < -70 || sx > W + 70 || sy < -20 || sy > H + 20) continue;
      if (!isHot) {
        if (focus !== null && !focus.has(node.id)) continue;
        if (labeled >= hubN) continue;
        labeled++;
      }
      const text = node.name.length > 16 ? `${node.name.slice(0, 15)}\u2026` : node.name;
      const ty = sy + nodeR(node) * view.k + 11;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(127,127,127,0.6)";
      ctx.strokeText(text, sx, ty);
      ctx.fillStyle = fg;
      ctx.fillText(text, sx, ty);
    }
    if (activeEdge !== null) {
      const ends = edgeEnds(activeEdge);
      if (ends !== null && !hidden.has(ends.a.type) && !hidden.has(ends.b.type)) {
        const mx = (ends.a.x + ends.b.x) / 2 * view.k + view.x;
        const my = (ends.a.y + ends.b.y) / 2 * view.k + view.y;
        const text = `${ends.e.type} \xB7 w=${ends.e.weight}`;
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(127,127,127,0.6)";
        ctx.strokeText(text, mx, my - 4);
        ctx.fillStyle = FOCUS_COLOR;
        ctx.fillText(text, mx, my - 4);
      }
    }
  };
  const stepRef = (0, import_react.useRef)(() => {
  });
  stepRef.current = () => {
    const d = dataRef.current;
    const wrap = wrapRef.current;
    if (d === null || wrap === null) return;
    if (!pausedRef.current && alphaRef.current > 0.015) {
      layoutStep(d);
      dirtyRef.current = true;
      frameRef.current++;
      if (!userMovedRef.current && (frameRef.current % 30 === 0 || alphaRef.current <= 0.015)) fitToView(false);
    }
    if (dirtyRef.current) {
      draw(wrap);
      dirtyRef.current = false;
    }
  };
  (0, import_react.useEffect)(() => {
    const tick = () => {
      stepRef.current();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    const ro = new ResizeObserver(() => {
      dirtyRef.current = true;
      const wrap2 = wrapRef.current;
      if (wrap2 !== null) fgRef.current = getComputedStyle(wrap2).color;
    });
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (wrap !== null) ro.observe(wrap);
    const onWheel = (e) => {
      e.preventDefault();
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect === null || rect === void 0) return;
      const v = viewRef.current;
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const k = Math.max(0.04, Math.min(4, v.k * factor));
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      viewRef.current = { k, x: cx - (cx - v.x) * k / v.k, y: cy - (cy - v.y) * k / v.k };
      userMovedRef.current = true;
      dirtyRef.current = true;
    };
    canvas?.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      canvas?.removeEventListener("wheel", onWheel);
    };
  }, []);
  const nodeR = (n) => 4 + Math.min(12, Math.sqrt(n.degree) * 1.7);
  const toWorld = (clientX, clientY) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect === void 0 || rect === null) return { x: 0, y: 0 };
    const v = viewRef.current;
    return { x: (clientX - rect.left - v.x) / v.k, y: (clientY - rect.top - v.y) / v.k };
  };
  const pickNode = (x, y) => {
    const idx = indexRef.current;
    if (idx === null) return null;
    const slop = 6 / viewRef.current.k;
    let best = null;
    let bestD = Infinity;
    for (const node of idx.byId.values()) {
      if (hiddenRef.current.has(node.type)) continue;
      const d = Math.hypot(node.x - x, node.y - y);
      if (d < nodeR(node) + slop && d < bestD) {
        best = node.id;
        bestD = d;
      }
    }
    return best;
  };
  const pickEdge = (x, y) => {
    const idx = indexRef.current;
    const d = dataRef.current;
    if (idx === null || d === null || viewRef.current.k < 0.6) return null;
    const slop = 5 / viewRef.current.k;
    let best = null;
    let bestD = slop;
    for (let i = 0; i < d.edges.length; i++) {
      const e = d.edges[i];
      const a = idx.byId.get(e.s);
      const b = idx.byId.get(e.t);
      if (a === void 0 || b === void 0 || hiddenRef.current.has(a.type) || hiddenRef.current.has(b.type)) continue;
      const dist = distToSeg(x, y, a.x, a.y, b.x, b.y);
      if (dist < bestD) {
        bestD = dist;
        best = i;
      }
    }
    return best;
  };
  const showTip = (x, y, key, text) => {
    if (tipKeyRef.current === key) return;
    tipKeyRef.current = key;
    setHoverTip({ x: x + 12, y: y + 8, text });
  };
  const clearTip = () => {
    if (tipKeyRef.current === "") return;
    tipKeyRef.current = "";
    setHoverTip(null);
  };
  const typesUsed = (0, import_react.useMemo)(() => {
    if (data === null) return [];
    const set = /* @__PURE__ */ new Map();
    for (const n of data.nodes) set.set(n.type, (set.get(n.type) ?? 0) + 1);
    return [...set.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);
  const matches = (0, import_react.useMemo)(() => {
    const q = search.trim().toLowerCase();
    if (q === "" || data === null) return [];
    const out = [];
    for (const n of data.nodes) {
      if (n.name.toLowerCase().includes(q)) {
        out.push(n);
        if (out.length >= 8) break;
      }
    }
    return out;
  }, [search, data]);
  if (loadErr !== null) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gv-graph", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-empty", children: [
      t("loadFailed"),
      ": ",
      loadErr
    ] }) });
  }
  if (data === null) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gv-graph", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gv-empty", children: t("loading") }) });
  }
  const selNode = selId !== null ? index?.byId.get(selId) : void 0;
  const selNeighbors = selId !== null && index !== null ? index.adj.get(selId) ?? [] : [];
  const resetDrag = () => {
    dragRef.current = { mode: "idle", id: null, sx: 0, sy: 0, ox: 0, oy: 0, moved: false };
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-graph", ref: wrapRef, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-graph-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gv-name", children: t("graphTitle") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "gv-badge", children: [
        t("graphCounts", { nodes: data.nodes.length, edges: data.edges.length }),
        hiddenTypes.size > 0 ? ` ${t("graphFiltered", { n: hiddenTypes.size })}` : ""
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-graph-search", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { value: search, placeholder: t("graphSearchPlaceholder"), onChange: (e) => setSearch(e.target.value) }),
        search.trim() !== "" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-graph-searchlist", children: [
          matches.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gv-graph-search-empty", children: t("graphSearchEmpty") }),
          matches.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { onClick: () => {
            locateNode(n);
            setSearch("");
          }, children: [
            n.name,
            "\uFF08",
            n.type,
            "\uFF09"
          ] }, n.id))
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "gv-btn", onClick: () => {
          pausedRef.current = !pausedRef.current;
          setLayoutPaused(pausedRef.current);
          dirtyRef.current = true;
        }, children: layoutPaused ? t("graphResume") : t("graphPause") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "gv-btn", onClick: () => {
          const d = dataRef.current;
          if (d === null) return;
          pausedRef.current = false;
          setLayoutPaused(false);
          seedPositions(d.nodes);
          alphaRef.current = 1;
          frameRef.current = 0;
          userMovedRef.current = false;
          dirtyRef.current = true;
        }, children: t("graphRelayout") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "gv-btn", onClick: () => fitToView(true), children: t("graphFit") }),
        (selId !== null || selEdge !== null) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "gv-btn", onClick: () => {
          applySel(null);
          applySelEdge(null);
        }, children: t("graphClearSel") })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gv-legend", children: typesUsed.map(([type, count]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { title: type, className: hiddenTypes.has(type) ? "gv-legend-off" : "", onClick: () => toggleType(type), children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { style: { background: typeColor(type) } }),
      type,
      " ",
      count
    ] }, type)) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "canvas",
      {
        ref: canvasRef,
        style: { cursor: "grab" },
        onPointerDown: (e) => {
          ;
          e.target.setPointerCapture?.(e.pointerId);
          const p = toWorld(e.clientX, e.clientY);
          const v = viewRef.current;
          dragRef.current = { mode: "press", id: pickNode(p.x, p.y), sx: e.clientX, sy: e.clientY, ox: v.x, oy: v.y, moved: false };
        },
        onPointerMove: (e) => {
          const drag = dragRef.current;
          if (drag.mode === "press") {
            if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 4) {
              drag.moved = true;
              if (drag.id === null) {
                const c2 = canvasRef.current;
                if (c2 !== null) c2.style.cursor = "grabbing";
              }
            }
            if (!drag.moved) return;
            if (drag.id !== null) {
              const node = indexRef.current?.byId.get(drag.id);
              const p2 = toWorld(e.clientX, e.clientY);
              if (node !== void 0) {
                node.x = p2.x;
                node.y = p2.y;
              }
            } else {
              const v = viewRef.current;
              viewRef.current = { ...v, x: drag.ox + (e.clientX - drag.sx), y: drag.oy + (e.clientY - drag.sy) };
              userMovedRef.current = true;
            }
            dirtyRef.current = true;
            return;
          }
          const p = toWorld(e.clientX, e.clientY);
          const rect = canvasRef.current?.getBoundingClientRect();
          const hx = e.clientX - (rect?.left ?? 0);
          const hy = e.clientY - (rect?.top ?? 0);
          const hn = pickNode(p.x, p.y);
          if (hn !== null) {
            if (hoverEdgeRef.current !== null) {
              hoverEdgeRef.current = null;
              dirtyRef.current = true;
            }
            if (hoverNodeRef.current !== hn) {
              hoverNodeRef.current = hn;
              dirtyRef.current = true;
            }
            const node = indexRef.current?.byId.get(hn);
            if (node !== void 0) showTip(hx, hy, `n${hn}`, `${node.name}\uFF08${node.type} \xB7 deg ${node.degree}\uFF09`);
            const c2 = canvasRef.current;
            if (c2 !== null) c2.style.cursor = "pointer";
            return;
          }
          if (hoverNodeRef.current !== null) {
            hoverNodeRef.current = null;
            dirtyRef.current = true;
          }
          const he = pickEdge(p.x, p.y);
          if (hoverEdgeRef.current !== he) {
            hoverEdgeRef.current = he;
            dirtyRef.current = true;
          }
          const c = canvasRef.current;
          if (c !== null) c.style.cursor = he !== null ? "pointer" : "grab";
          if (he !== null) {
            const e2 = dataRef.current?.edges[he];
            const a = e2 !== void 0 ? indexRef.current?.byId.get(e2.s) : void 0;
            const b = e2 !== void 0 ? indexRef.current?.byId.get(e2.t) : void 0;
            if (e2 !== void 0 && a !== void 0 && b !== void 0) showTip(hx, hy, `e${he}`, `${a.name} \u2014${e2.type}\u2192 ${b.name} \xB7 w=${e2.weight}`);
          } else clearTip();
        },
        onPointerUp: (e) => {
          const drag = dragRef.current;
          resetDrag();
          const c = canvasRef.current;
          if (c !== null) c.style.cursor = "grab";
          if (drag.mode !== "press" || drag.moved) return;
          if (drag.id !== null) {
            applySelEdge(null);
            applySel(selRef.current === drag.id ? null : drag.id);
          } else {
            const p = toWorld(e.clientX, e.clientY);
            const he = pickEdge(p.x, p.y);
            if (he !== null) {
              applySel(null);
              applySelEdge(selEdgeRef.current === he ? null : he);
            } else {
              applySel(null);
              applySelEdge(null);
            }
          }
        },
        onPointerLeave: () => {
          resetDrag();
          hoverNodeRef.current = null;
          hoverEdgeRef.current = null;
          dirtyRef.current = true;
          clearTip();
        }
      }
    ),
    hoverTip !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gv-graph-tip", style: { left: hoverTip.x, top: hoverTip.y }, children: hoverTip.text }),
    selNode !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-graph-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-graph-card-head", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gv-name", children: selNode.name }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gv-badge", children: selNode.type }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "gv-badge", children: [
          "deg ",
          selNode.degree
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-graph-card-tools", children: [
          canLocate && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "gv-btn", onClick: () => {
            document.getElementById(`gv-card-${selNode.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
          }, children: t("graphLocate") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "gv-btn", title: t("graphClearSel"), onClick: () => {
            applySel(null);
            applySelEdge(null);
          }, children: "\xD7" })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-graph-card-body", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gv-cost", children: t("graphNeighbors", { n: selNeighbors.length }) }),
        selNeighbors.map((link, i) => {
          const other = index?.byId.get(link.other);
          return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { className: "gv-graph-card-row", disabled: other === void 0, onClick: () => {
            if (other !== void 0) locateNode(other);
          }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gv-cost", children: link.edge.s === selNode.id ? "\u2192" : "\u2190" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gv-cost", children: link.edge.type }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: other?.name ?? "?" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "gv-cost", children: [
              "w=",
              link.edge.weight
            ] })
          ] }, i);
        })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-graph-ctl", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "gv-btn", title: t("graphZoomIn"), onClick: () => zoomStep(1.25), children: "\uFF0B" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "gv-btn", title: t("graphZoomOut"), onClick: () => zoomStep(0.8), children: "\uFF0D" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gv-graph-hint", children: t("graphHint") })
  ] });
}
function ReviewTab(props) {
  const { runtime, t, kbId } = props;
  const [samples, setSamples] = (0, import_react.useState)([]);
  const [loading, setLoading] = (0, import_react.useState)(true);
  const [idx, setIdx] = (0, import_react.useState)(0);
  const [done, setDone] = (0, import_react.useState)(0);
  const [correcting, setCorrecting] = (0, import_react.useState)(null);
  const [seeding, setSeeding] = (0, import_react.useState)(false);
  const [selChip, setSelChip] = (0, import_react.useState)(null);
  const onEvidenceMouseUp = () => {
    const sel = window.getSelection();
    const text = sel?.toString() ?? "";
    const anchor = sel?.anchorNode?.parentElement;
    if (sel === null || sel.isCollapsed || text.trim().length < 2 || anchor === null || anchor === void 0 || anchor.closest(".gv-md, .gv-pre") === null) {
      setSelChip(null);
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setSelChip({ x: Math.max(8, rect.left), y: rect.bottom + 6, text: text.trim().slice(0, 2e3) });
  };
  const seedFromSelection = (selected) => {
    setSelChip(null);
    setSeeding(true);
    void unwrap(runtime.rpc.call(RPC_CHANNEL, "correctFromSelection", { id: kbId, text: selected })).then((v) => {
      const triples = v.triples ?? [];
      const best = triples[0];
      setCorrecting((prev) => ({
        verdict: prev?.verdict ?? "wrong",
        s: best?.s ?? prev?.s ?? "",
        r: best?.r ?? prev?.r ?? "",
        o: best?.o ?? prev?.o ?? ""
      }));
      if (best === void 0) runtime.pushNotice(t("selNoTriple"));
    }).catch((err) => runtime.pushNotice(`${t("selFailed")}: ${err instanceof Error ? err.message : String(err)}`)).finally(() => setSeeding(false));
  };
  const load = () => {
    setLoading(true);
    void unwrap(runtime.rpc.call(RPC_CHANNEL, "sampleReview", { id: kbId, limit: 20 })).then((v) => {
      setSamples(v);
      setIdx(0);
    }).catch((err) => runtime.pushNotice(`${t("loadFailed")}: ${err instanceof Error ? err.message : String(err)}`)).finally(() => setLoading(false));
  };
  (0, import_react.useEffect)(() => {
    load();
  }, [kbId]);
  const verdict = (v, correction) => {
    const sample = samples[idx];
    if (sample === void 0) return;
    const payload = { id: kbId, relationId: sample.id, verdict: v };
    if (correction !== void 0) {
      const correction2 = {};
      if (correction.s.trim() !== "" && correction.s.trim() !== sample.s) correction2.s = correction.s.trim();
      if (correction.r.trim() !== "" && correction.r.trim() !== sample.r) correction2.r = correction.r.trim();
      if (correction.o.trim() !== "" && correction.o.trim() !== sample.o) correction2.o = correction.o.trim();
      if (Object.keys(correction2).length > 0) payload["correction"] = correction2;
    }
    void unwrap(runtime.rpc.call(RPC_CHANNEL, "review", payload)).then(() => {
      setCorrecting(null);
      setDone((n) => n + 1);
      if (idx + 1 >= samples.length) load();
      else setIdx(idx + 1);
    }).catch((err) => runtime.pushNotice(String(err)));
  };
  const current = samples[idx];
  if (loading) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gv-empty", children: t("loading") });
  if (current === void 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-empty", children: [
      t("reviewExhausted", { done }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gv-actions", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "gv-btn", onClick: load, children: t("resample") }) })
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "gv-sub", children: t("reviewHint", { i: idx + 1, n: samples.length, done }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-card-head", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gv-name", children: current.s }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gv-badge", children: current.r }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gv-name", children: current.o }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "gv-badge", children: [
          t("confidence"),
          ": ",
          current.confidence.toFixed(2)
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gv-sub", children: t("reviewQuestion") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { onMouseUp: onEvidenceMouseUp, children: current.evidence.map((ev, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-evidence", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-cost", children: [
          ev.path,
          ":",
          ev.startLine,
          "-",
          ev.endLine
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChunkText, { text: ev.text, t })
      ] }, i)) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "gv-btn gv-btn-primary", onClick: () => verdict("correct"), children: t("verdictCorrect") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "gv-btn gv-btn-danger", onClick: () => setCorrecting({ verdict: "wrong", s: current.s, r: current.r, o: current.o }), children: t("verdictWrong") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "gv-btn", onClick: () => setCorrecting({ verdict: "unsure", s: current.s, r: current.r, o: current.o }), children: t("verdictUnsure") })
      ] }),
      correcting !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-form", style: { marginTop: 10 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontSize: 12, color: "var(--gv-fg-secondary, var(--dsw-alias-label-secondary, #5a6472))" }, children: [
          t("correctionTitle"),
          seeding && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u2026" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: t("correctionS") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { value: correcting.s, onChange: (e) => setCorrecting({ ...correcting, s: e.target.value }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: t("correctionR") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { value: correcting.r, onChange: (e) => setCorrecting({ ...correcting, r: e.target.value }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: t("correctionO") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { value: correcting.o, onChange: (e) => setCorrecting({ ...correcting, o: e.target.value }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-actions", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "gv-btn gv-btn-primary", onClick: () => verdict(correcting.verdict, { s: correcting.s, r: correcting.r, o: correcting.o }), children: t("correctionSubmit") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "gv-btn", onClick: () => verdict(correcting.verdict), children: correcting.verdict === "wrong" ? t("verdictOnlyWrong") : t("verdictOnlyUnsure") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "gv-btn", onClick: () => setCorrecting(null), children: t("cancel") })
        ] })
      ] }),
      selChip !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          className: "gv-btn gv-btn-primary gv-selchip",
          style: { left: selChip.x, top: selChip.y },
          onMouseDown: (e) => e.preventDefault(),
          onClick: () => seedFromSelection(selChip.text),
          children: t("selCorrect")
        }
      )
    ] })
  ] });
}
function ManageTab(props) {
  const { runtime, t, kbId, roots } = props;
  const [title, setTitle] = (0, import_react.useState)("");
  const [text, setText] = (0, import_react.useState)("");
  const [filter, setFilter] = (0, import_react.useState)("");
  const [sources, setSources] = (0, import_react.useState)([]);
  const [changes, setChanges] = (0, import_react.useState)(null);
  const [rootsText, setRootsText] = (0, import_react.useState)(roots.join("\n"));
  const [rootsSaved, setRootsSaved] = (0, import_react.useState)(false);
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [busyPath, setBusyPath] = (0, import_react.useState)(null);
  const loadSources = () => {
    void unwrap(runtime.rpc.call(RPC_CHANNEL, "sources", { id: kbId })).then((v) => setSources(v)).catch((err) => runtime.pushNotice(String(err)));
  };
  const loadChanges = () => {
    void unwrap(runtime.rpc.call(RPC_CHANNEL, "changes", { id: kbId })).then((v) => setChanges(v)).catch(() => setChanges(null));
  };
  (0, import_react.useEffect)(() => {
    loadSources();
    loadChanges();
  }, [kbId]);
  const addText = () => {
    if (text.trim() === "") return;
    setBusy(true);
    void unwrap(runtime.rpc.call(RPC_CHANNEL, "addText", { id: kbId, title: title.trim(), text })).then(() => {
      runtime.pushNotice(t("manageNoteAdded"));
      setTitle("");
      setText("");
      loadSources();
    }).catch((err) => runtime.pushNotice(String(err))).finally(() => setBusy(false));
  };
  const runFor = (rpc, payload, notice) => {
    setBusyPath(String(payload["path"] ?? ""));
    void unwrap(runtime.rpc.call(RPC_CHANNEL, rpc, { id: kbId, ...payload })).then(() => {
      runtime.pushNotice(notice);
      loadSources();
      loadChanges();
    }).catch((err) => runtime.pushNotice(String(err))).finally(() => setBusyPath(null));
  };
  const removeSource = (path) => {
    if (!window.confirm(t("manageConfirmDelete"))) return;
    runFor("forgetFile", { path }, t("manageFileDeleted"));
  };
  const reindexSource = (path) => {
    runFor("reindexSource", { path }, t("manageReindexed"));
  };
  const toggleSource = (path, enabled) => {
    runFor("setSourceEnabled", { path, enabled }, enabled ? t("manageEnabled") : t("manageDisabled"));
  };
  const importDirectory = () => {
    setBusy(true);
    void runtime.bridge.pickDirectory().then((dir) => {
      if (dir === null) return;
      return unwrap(runtime.rpc.call(RPC_CHANNEL, "importFiles", { id: kbId, dir })).then((v) => {
        const r = v;
        runtime.pushNotice(t("manageImported", { count: r.imported, skipped: r.skipped.length }));
        loadSources();
        loadChanges();
      });
    }).catch((err) => runtime.pushNotice(String(err))).finally(() => setBusy(false));
  };
  const saveRoots = () => {
    const next = rootsText.split("\n").map((l) => l.trim()).filter((l) => l !== "");
    setBusy(true);
    void unwrap(runtime.rpc.call(RPC_CHANNEL, "updateKb", { id: kbId, roots: next })).then(() => {
      setRootsSaved(true);
      setTimeout(() => setRootsSaved(false), 2e3);
    }).catch((err) => runtime.pushNotice(String(err))).finally(() => setBusy(false));
  };
  const visible = sources.filter((s) => filter.trim() === "" || s.path.toLowerCase().includes(filter.trim().toLowerCase()));
  const changeTotal = changes === null ? 0 : changes.added + changes.changed.length + changes.removed.length;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gv-card-head", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gv-name", children: t("manageAddTitle") }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: t("manageAddName") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { value: title, onChange: (e) => setTitle(e.target.value), placeholder: t("manageAddNameHint") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: t("manageAddText") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", { value: text, onChange: (e) => setText(e.target.value), style: { minHeight: 140 }, placeholder: t("manageAddTextHint") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "gv-btn gv-btn-primary", disabled: busy || text.trim() === "", onClick: addText, children: t("manageAddSubmit") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "gv-btn", disabled: busy, onClick: importDirectory, children: t("manageImport") })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-card-head", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gv-name", children: t("manageSources") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            value: filter,
            onChange: (e) => setFilter(e.target.value),
            placeholder: t("manageFilterHint"),
            style: { flex: 1, minWidth: 120 }
          }
        )
      ] }),
      changes !== null && changeTotal > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-notice", style: { marginBottom: 8 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("manageChanges", { added: changes.added, changed: changes.changed.length, removed: changes.removed.length }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "gv-btn", onClick: () => {
          void runtime.startIndex(kbId);
        }, children: t("manageSyncIndex") })
      ] }),
      visible.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gv-empty", children: sources.length === 0 ? t("manageEmpty") : t("manageNoMatch") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("table", { className: "gv-table", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: visible.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", { style: { wordBreak: "break-all" }, children: [
          s.path,
          s.isNote && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gv-badge", style: { marginLeft: 6 }, children: t("badgeNote") }),
          s.state === "disabled" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gv-badge", style: { marginLeft: 4 }, children: t("badgeDisabled") }),
          s.error !== null && s.error !== "" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gv-cost", children: s.error })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { style: { width: 56 }, children: s.ext !== "" ? s.ext.slice(1) : "\u2014" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { style: { width: 60 }, children: s.state }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { style: { width: 96 }, className: "gv-cost", children: t("manageContribution", { chunks: s.stats.chunks, entities: s.stats.entities, relations: s.stats.relations }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { style: { width: 84 }, className: "gv-cost", children: formatTime(s.mtimeMs, t) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { style: { width: 150 }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-actions", style: { margin: 0, flexWrap: "nowrap" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "gv-btn", disabled: busyPath !== null, onClick: () => reindexSource(s.path), children: t("manageReindex") }),
          s.state === "disabled" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "gv-btn", disabled: busyPath !== null, onClick: () => toggleSource(s.path, true), children: t("manageEnable") }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "gv-btn", disabled: busyPath !== null, onClick: () => toggleSource(s.path, false), children: t("manageDisable") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "gv-btn gv-btn-danger", disabled: busyPath !== null, onClick: () => removeSource(s.path), children: t("manageDelete") })
        ] }) })
      ] }, s.path)) }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gv-card-head", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gv-name", children: t("manageRootsTitle") }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", { value: rootsText, onChange: (e) => {
        setRootsText(e.target.value);
        setRootsSaved(false);
      }, style: { minHeight: 60 } }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gv-actions", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "gv-btn", disabled: busy, onClick: saveRoots, children: rootsSaved ? t("manageRootsSaved") : t("manageRootsSave") }) })
    ] })
  ] });
}
function HealthTab(props) {
  const { runtime, t, kbId } = props;
  const [report, setReport] = (0, import_react.useState)(null);
  const [loading, setLoading] = (0, import_react.useState)(true);
  (0, import_react.useEffect)(() => {
    setLoading(true);
    void unwrap(runtime.rpc.call(RPC_CHANNEL, "health", { id: kbId })).then((v) => setReport(v)).catch((err) => runtime.pushNotice(String(err))).finally(() => setLoading(false));
  }, [kbId]);
  if (loading || report === null) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gv-empty", children: t("loading") });
  const pct = (x) => x === null ? t("never") : `${Math.round(x * 100)}%`;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-card", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gv-card-head", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "gv-name", children: [
      t("healthTitle"),
      " \u2014 ",
      report.kbName
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("table", { className: "gv-table", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: t("coverage") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: pct(report.coverage) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: t("filesIndexed") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", { children: [
          report.files.indexed,
          report.files.stale > 0 ? `\uFF08${t("stale")} ${report.files.stale}\uFF09` : ""
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: t("quarantined") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", { children: [
          report.files.quarantined,
          report.quarantineRate !== null ? `\uFF08${pct(report.quarantineRate)}\uFF09` : ""
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: t("samplePrecision") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: report.samplePrecision === null ? t("never") : `${report.correct}/${report.sampled} = ${pct(report.samplePrecision)}` })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: t("healthCorrected") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: report.corrected })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: t("excluded") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: report.excludedRelations })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: t("lastIndex") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: formatAt(report.lastIndexAt) })
      ] })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "gv-sub", children: t("healthNote") })
  ] });
}
function formatAt(at) {
  if (at === null || at === 0) return "\u2014";
  const d = new Date(at);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// src/client/view.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
function KbManagerView(props) {
  const { runtime, t, bridge } = props;
  const state = (0, import_react2.useSyncExternalStore)(runtime.source.subscribe, runtime.source.getSnapshot);
  const notice = (0, import_react2.useSyncExternalStore)(runtime.notice.subscribe, runtime.notice.getSnapshot);
  (0, import_react2.useEffect)(() => {
    runtime.start();
    return () => runtime.stop();
  }, [runtime]);
  const [formOpen, setFormOpen] = (0, import_react2.useState)(false);
  const kbs = state.snapshot ? sortKbs(state.snapshot.kbs) : [];
  const delegateExplore = () => {
    void bridge.delegate(t("agentExplorePrompt")).then((result) => {
      runtime.pushNotice(t(`delegate${result.charAt(0).toUpperCase()}${result.slice(1)}`));
      if (result !== "none") setFormOpen(false);
    });
  };
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gv-panel", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h2", { children: t("title") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "gv-btn", onClick: () => setFormOpen((open) => !open), children: formOpen ? t("closeForm") : t("newKb") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "gv-sub", children: t("subtitle") }),
    notice !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gv-notice", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: notice }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "gv-btn", onClick: () => runtime.dismissNotice(), children: t("dismiss") })
    ] }),
    state.phase === "error" && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gv-error", children: [
      t("loadFailed"),
      ": ",
      state.error
    ] }),
    formOpen && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(CreateForm, { runtime, t, bridge, onDone: () => setFormOpen(false) }),
    state.phase === "ready" && kbs.length === 0 && !formOpen && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gv-empty", children: [
      t("empty"),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { marginTop: 10 }, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "gv-btn", onClick: delegateExplore, children: t("agentDelegateEmpty") }) })
    ] }),
    kbs.map((kb) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(KbCard, { kb, runtime, t }, kb.id))
  ] });
}
function CreateForm(props) {
  const { runtime, t, bridge, onDone } = props;
  const [name2, setName] = (0, import_react2.useState)("");
  const [rootsText, setRootsText] = (0, import_react2.useState)("");
  const [description, setDescription] = (0, import_react2.useState)("");
  const [picking, setPicking] = (0, import_react2.useState)(false);
  const [workspaceId, setWorkspaceId] = (0, import_react2.useState)("");
  const [modelKey, setModelKey] = (0, import_react2.useState)("");
  const [workspaces, setWorkspaces] = (0, import_react2.useState)([]);
  const [catalog, setCatalog] = (0, import_react2.useState)([]);
  (0, import_react2.useEffect)(() => {
    setWorkspaces(bridge.listWorkspaces());
    void bridge.loadModelCatalog().then(setCatalog);
  }, [bridge]);
  const rootsOf = () => rootsText.split("\n").map((line) => line.trim()).filter((line) => line !== "");
  const pick = () => {
    setPicking(true);
    void bridge.pickDirectory().then((dir) => {
      if (dir !== null && !rootsOf().includes(dir)) {
        setRootsText((text) => text.trim() === "" ? dir : `${text.trimEnd()}
${dir}`);
      }
    }).catch(() => runtime.pushNotice(t("pickUnavailable"))).finally(() => setPicking(false));
  };
  const submit = () => {
    const roots = rootsOf();
    if (name2.trim() === "" || roots.length === 0) return;
    void runtime.create({ name: name2.trim(), roots, description: description.trim() !== "" ? description.trim() : void 0 }).then(onDone);
  };
  const delegate = () => {
    const roots = rootsOf();
    if (roots.length === 0) {
      runtime.pushNotice(t("delegateRootsRequired"));
      return;
    }
    const prompt = t("agentCreatePrompt", { name: name2.trim() !== "" ? name2.trim() : roots[0], roots: roots.map((r) => `- ${r}`).join("\n") });
    const chosen = catalog.find((entry) => `${entry.provider}|${entry.model}` === modelKey);
    void bridge.delegate(prompt, {
      workspaceId: workspaceId !== "" ? workspaceId : void 0,
      model: chosen !== void 0 ? { provider: chosen.provider, model: chosen.model } : void 0
    }).then((result) => {
      runtime.pushNotice(t(`delegate${result.charAt(0).toUpperCase()}${result.slice(1)}`));
      if (result !== "none") onDone();
    });
  };
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gv-form", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("label", { children: t("formName") }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { value: name2, onChange: (e) => setName(e.target.value), placeholder: t("formNameHint") }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", gap: 12, flexWrap: "wrap" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { flex: "1 1 220px" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("label", { children: t("formWorkspace") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("select", { className: "gv-select", value: workspaceId, onChange: (e) => setWorkspaceId(e.target.value), children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: "", children: t("formWorkspaceFollow") }),
          workspaces.map((ws) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: ws.id, children: ws.title }, ws.id))
        ] })
      ] }),
      catalog.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { flex: "1 1 220px" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("label", { children: t("formModel") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("select", { className: "gv-select", value: modelKey, onChange: (e) => setModelKey(e.target.value), children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: "", children: t("formModelFollow") }),
          catalog.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: `${entry.provider}|${entry.model}`, children: entry.modelName === entry.model ? `${entry.providerName} / ${entry.model}` : `${entry.modelName}` }, `${entry.provider}|${entry.model}`))
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { fontSize: 11, color: "var(--gv-fg-muted, var(--dsw-alias-label-tertiary, #8a94a3))", marginTop: 4 }, children: t("formModelHint") })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8, margin: "8px 0 4px" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { fontSize: 12, color: "var(--gv-fg-secondary, var(--dsw-alias-label-secondary, #5a6472))" }, children: t("formRoots") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "gv-btn", disabled: picking, onClick: pick, children: picking ? "\u2026" : t("pickDir") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("textarea", { value: rootsText, onChange: (e) => setRootsText(e.target.value), placeholder: t("formRootsHint") }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("label", { children: t("formDesc") }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { value: description, onChange: (e) => setDescription(e.target.value), placeholder: t("formDescHint") }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gv-actions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "gv-btn gv-btn-primary", disabled: name2.trim() === "" || rootsText.trim() === "", onClick: submit, children: t("create") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "gv-btn", disabled: rootsText.trim() === "", onClick: delegate, children: t("agentDelegate") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "gv-btn", onClick: onDone, children: t("cancel") })
    ] })
  ] });
}
function KbCard(props) {
  const { kb, runtime, t } = props;
  const [exploreOpen, setExploreOpen] = (0, import_react2.useState)(false);
  const progress = kb.progress;
  const running = progress !== null && progress.phase !== "done" && progress.phase !== "error";
  const pct = progress !== null && progress.filesTotal > 0 ? Math.round(progress.filesDone / progress.filesTotal * 100) : running ? 5 : 0;
  const remove = () => {
    if (window.confirm(t("confirmDelete", { name: kb.name }))) void runtime.remove(kb.id);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gv-card", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gv-card-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "gv-name", children: kb.name }),
      kb.managed === "config" && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "gv-badge", children: t("managedByConfig") }),
      progress !== null && progress.phase === "error" && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "gv-badge", children: t("phaseError") }),
      progress !== null && progress.phase === "done" && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "gv-badge", children: t("phaseDone") })
    ] }),
    kb.description !== null && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { children: kb.description }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "gv-roots", children: kb.roots.join("  \xB7  ") || t("noRoots") }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gv-stats", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
        t("filesIndexed"),
        ": ",
        progress !== null && running ? `${progress.filesDone}/${progress.filesTotal}` : kb.filesIndexed
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
        t("entities"),
        ": ",
        kb.entities
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
        t("relations"),
        ": ",
        kb.relations
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
        t("quarantined"),
        ": ",
        progress?.quarantined ?? 0
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
        t("lastIndex"),
        ": ",
        formatTime(kb.lastIndexedAt, t)
      ] })
    ] }),
    running && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "gv-bar", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "gv-bar-fill", style: { width: `${pct}%` } }) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gv-current", children: [
        t("phaseLabel", { phase: progress?.phase ?? "" }),
        progress?.currentFile !== null && progress?.currentFile !== void 0 ? ` \u2014 ${progress.currentFile}` : "",
        " \xB7 ",
        "LLM ",
        progress?.llmCalls ?? 0
      ] })
    ] }),
    progress !== null && progress.phase === "error" && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "gv-error", children: progress.error }),
    progress !== null && progress.phase === "done" && progress.report !== null && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "gv-cost", children: t("lastReport", {
      added: progress.report.graphDelta.entitiesAdded,
      relations: progress.report.graphDelta.relationsAdded,
      calls: progress.report.cost.llmCalls
    }) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gv-actions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "gv-btn gv-btn-primary", disabled: running || kb.managed === "config" && kb.roots.length === 0, onClick: () => void runtime.startIndex(kb.id), children: t("index") }),
      running && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "gv-btn gv-btn-danger", onClick: () => void runtime.cancel(kb.id), children: t("cancelIndex") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "gv-btn", onClick: () => setExploreOpen((open) => !open), children: exploreOpen ? t("closeExplore") : t("explore") }),
      kb.managed !== "config" && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "gv-btn gv-btn-danger", onClick: remove, children: t("delete") })
    ] }),
    exploreOpen && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(BrowseReviewView, { runtime, t, kbId: kb.id, roots: kb.roots })
  ] });
}
function formatTime(at, t) {
  if (at === null || at === 0) return t("never");
  const d = new Date(at);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// src/client/index.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var name = "dsh-kylin-vibe";
var inject = [
  "slots",
  "connection",
  "locale",
  "sessions",
  "uiWorkspace",
  "workspaces",
  "remote",
  "remote.session",
  "modelDirectories",
  "layout"
];
var PANEL_ID = "ky-graphrag";
function fallbackTranslator(lang) {
  return (key, params) => {
    const table = lang === "en" ? dictionaries.en : zh;
    const template = table[key] ?? zh[key] ?? key;
    if (params === void 0) return template;
    return template.replace(/\{(\w+)\}/g, (_m, name2) => String(params[name2] ?? `{${name2}}`));
  };
}
function browserLang() {
  try {
    const languages = navigator.languages ?? [navigator.language];
    return (languages[0] ?? "zh").toLowerCase().startsWith("zh") ? "zh" : "en";
  } catch {
    return "zh";
  }
}
function apply(ctx) {
  const disposeStyles = installStyles();
  const localeService = ctx.locale;
  if (localeService?.register !== void 0) {
    ctx.effect(
      () => localeService.register(NS, { zh: { ...zh }, en: { ...dictionaries.en } }),
      "ky-graphrag: dictionaries"
    );
  }
  const t = localeService?.bind !== void 0 ? localeService.bind(NS) : fallbackTranslator(browserLang());
  const runtime = createKbRuntime({
    rpc: {
      call: (channel, endpoint, payload) => {
        if (ctx.connection?.rpc === void 0) {
          return Promise.reject(new Error(t("channelUnavailable")));
        }
        return ctx.connection.rpc.call(channel, endpoint, payload);
      }
    }
  });
  const bridge = createHostBridge({
    sessions: ctx.sessions,
    uiWorkspace: ctx.uiWorkspace,
    workspaces: ctx.workspaces,
    remote: ctx.remote,
    modelDirectories: ctx.modelDirectories,
    layout: ctx.layout
  });
  if (ctx.slots?.inject !== void 0) {
    try {
      ctx.slots.inject("sidebar.panellist", () => {
        const disposeIcon = ctx.slots.register({
          name: "sidebar.panellist",
          id: PANEL_ID,
          order: 125,
          label: () => t("nav"),
          locale: NS
        }, PanelIcon);
        const disposePanel = ctx.slots.register({
          name: "main",
          key: PANEL_ID,
          locale: NS
        }, function KbManagerMount() {
          return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(KbManagerView, { runtime, t, bridge });
        });
        return () => {
          disposePanel();
          disposeIcon();
        };
      });
    } catch (error) {
      console.warn("[dsh-kylin-vibe] sidebar/main slot registration skipped:", error);
    }
  }
  ctx.effect(() => disposeStyles, "ky-graphrag: styles");
}
function PanelIcon(props) {
  const size = props.size ?? 18;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("circle", { cx: "12", cy: "12", r: "9" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("circle", { cx: "9", cy: "10", r: "2.2" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("circle", { cx: "15", cy: "9", r: "1.8" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("circle", { cx: "13.5", cy: "15", r: "2.4" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M10.8 11.4 12 13" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M14.2 9.8 14 12.8" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M11 10 13.3 9.3" })
  ] });
}
return module.exports; } });
//# sourceMappingURL=client.js.map
