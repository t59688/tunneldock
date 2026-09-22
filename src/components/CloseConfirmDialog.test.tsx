import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CloseConfirmDialog } from "./CloseConfirmDialog";
import { I18nProvider } from "../i18n";

describe("CloseConfirmDialog", () => {
  it("renders an accessible themed choice between tray and exit", () => {
    const closedMarkup = renderToStaticMarkup(
      <I18nProvider>
        <CloseConfirmDialog
          open={false}
          busy={false}
          error={null}
          onResolve={() => undefined}
        />
      </I18nProvider>
    );
    const openMarkup = renderToStaticMarkup(
      <I18nProvider>
        <CloseConfirmDialog
          open
          busy={false}
          error={null}
          onResolve={() => undefined}
        />
      </I18nProvider>
    );

    expect(closedMarkup).toBe("");
    expect(openMarkup).toContain('role="dialog"');
    expect(openMarkup).toContain('aria-modal="true"');
    expect(openMarkup).toContain("最小化到托盘");
    expect(openMarkup).toContain("直接退出");
    expect(openMarkup).toContain("取消");
  });

  it("shows action-neutral progress while resolving the choice", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <CloseConfirmDialog
          open
          busy
          error={null}
          onResolve={() => undefined}
        />
      </I18nProvider>
    );

    expect(markup).toContain("正在处理关闭操作");
  });
});
