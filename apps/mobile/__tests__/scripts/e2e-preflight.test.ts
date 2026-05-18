interface E2ePreflightModule {
  appendAndroidPlatform(url: string): string;
  currentFocusShowsDevMenu(currentFocus: string): boolean;
  currentFocusShowsLauncher(currentFocus: string): boolean;
  isAppReady(uiXml: string): boolean;
}

const preflight = jest.requireActual(
  "../../scripts/e2e-preflight"
) as E2ePreflightModule;

describe("e2e-preflight", () => {
  it("forces Android platform in Metro URLs", () => {
    expect(
      preflight.appendAndroidPlatform(
        "http://127.0.0.1:8081/status?platform=ios"
      )
    ).toBe("http://127.0.0.1:8081/status?platform=android");
  });

  it("treats the pre-auth pitch carousel as loaded product UI", () => {
    expect(preflight.isAppReady('<node text="Skip" />')).toBe(true);
    expect(preflight.isAppReady('<node text="Track with your voice." />')).toBe(
      true
    );
  });

  it("does not treat the Expo developer menu as product UI", () => {
    expect(
      preflight.isAppReady(
        '<node text="This is the developer menu" /><node text="Skip" />'
      )
    ).toBe(false);
  });

  it("does not treat stale DevMenuActivity records as the focused dev menu", () => {
    expect(
      preflight.currentFocusShowsDevMenu(`
        Display #0 currentFocus=Window{ad25cd0 u0 com.google.android.apps.nexuslauncher/com.google.android.apps.nexuslauncher.NexusLauncherActivity}
        mFocusedApp=ActivityRecord{e4594ea u0 com.monyvi.app/expo.modules.devmenu.DevMenuActivity t10}
        Window #9 Window{b4ae2b7 u0 com.monyvi.app/expo.modules.devmenu.DevMenuActivity}
      `)
    ).toBe(false);
  });

  it("detects the developer menu when it owns the focused window", () => {
    expect(
      preflight.currentFocusShowsDevMenu(
        "mCurrentFocus=Window{b4ae2b7 u0 com.monyvi.app/expo.modules.devmenu.DevMenuActivity}"
      )
    ).toBe(true);
  });

  it("detects launcher focus even when stale dev menu records are present", () => {
    expect(
      preflight.currentFocusShowsLauncher(`
        Display #0 currentFocus=Window{ad25cd0 u0 com.google.android.apps.nexuslauncher/com.google.android.apps.nexuslauncher.NexusLauncherActivity}
        focusedApp=ActivityRecord{4efef91 u0 com.google.android.apps.nexuslauncher/.NexusLauncherActivity t7}
        mFocusedApp=ActivityRecord{e4594ea u0 com.monyvi.app/expo.modules.devmenu.DevMenuActivity t10}
        Window #9 Window{b4ae2b7 u0 com.monyvi.app/expo.modules.devmenu.DevMenuActivity}
      `)
    ).toBe(true);
  });

  it("detects launcher ANR focus from dumpsys", () => {
    expect(
      preflight.currentFocusShowsLauncher(`
        WINDOW MANAGER WINDOWS (dumpsys window windows)
        mCurrentFocus=Window{c343781 u0 Application Not Responding: com.google.android.apps.nexuslauncher}
        mFocusedApp=ActivityRecord{e4594ea u0 com.monyvi.app/expo.modules.devmenu.DevMenuActivity t10}
      `)
    ).toBe(true);
  });

  it("ignores stale launcher focus from the last ANR section", () => {
    expect(
      preflight.currentFocusShowsLauncher(`
        WINDOW MANAGER LAST ANR (dumpsys window lastanr)
        Display #0 currentFocus=Window{e5ceca1 u0 com.google.android.apps.nexuslauncher/com.google.android.apps.nexuslauncher.NexusLauncherActivity}
        WINDOW MANAGER WINDOWS (dumpsys window windows)
        mCurrentFocus=Window{31b944f u0 com.monyvi.app/com.monyvi.MainActivity}
      `)
    ).toBe(false);
  });

  it("detects current launcher focus after a stale last ANR section", () => {
    expect(
      preflight.currentFocusShowsLauncher(`
        WINDOW MANAGER LAST ANR (dumpsys window lastanr)
        Display #0 currentFocus=Window{31b944f u0 com.monyvi.app/com.monyvi.MainActivity}
        WINDOW MANAGER WINDOWS (dumpsys window windows)
        mCurrentFocus=Window{e5ceca1 u0 com.google.android.apps.nexuslauncher/com.google.android.apps.nexuslauncher.NexusLauncherActivity}
      `)
    ).toBe(true);
  });
});
