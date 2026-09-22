#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Locale {
    ZhCn,
    EnUs,
}

impl Locale {
    pub fn from_str(value: &str) -> Self {
        if value.starts_with("en") || value.starts_with("EN") {
            Self::EnUs
        } else {
            Self::ZhCn
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::ZhCn => "zh-CN",
            Self::EnUs => "en-US",
        }
    }
}

use std::borrow::Cow;

pub fn t<'a>(locale: &str, key: &'a str) -> Cow<'a, str> {
    let loc = Locale::from_str(locale);
    match loc {
        Locale::ZhCn => translate_zh(key),
        Locale::EnUs => translate_en(key),
    }
}

fn translate_zh<'a>(key: &'a str) -> Cow<'a, str> {
    let val = match key {
        // Tray
        "tray.show_main_window" => "显示主界面",
        "tray.exit" => "退出",
        "tray.tooltip" => "TunnelDock",

        // Common errors
        "error.tunnel_id_and_key_required" => "Tunnel ID 和 API Key 均不能为空",
        "error.workspace_not_found" => "工作区未找到",
        "error.workspace_dir_not_found" => "工作区目录不存在",
        "error.workspace_path_invalid" => "指定的项目目录不存在或不是有效文件夹",
        "error.workspace_path_exists" => "该工作区路径已存在于列表中",
        "error.unsupported_platform" => "当前平台不支持此操作",

        // Env Check Names
        "env.name.node" => "Node.js 运行时",
        "env.name.npm" => "npm 包管理器",
        "env.name.git" => "Git 版本控制",
        "env.name.cargo" => "Rust / Cargo 工具链",
        "env.name.cargo_binstall" => "cargo-binstall 极速安装器",
        "env.name.otunnel" => "OpenAI otunnel 客户端",
        "env.name.pi" => "Pi Coding Agent 运行时",
        "env.name.chappie" => "Chappie MCP 插件扩展",
        "env.name.tunnel_key" => "OpenAI Tunnel 凭据 (tunnelkey.txt)",
        "env.name.tunnel_config" => "Otunnel 配置文件 (chappie.yaml)",

        // Git Status
        "workspace.git_clean" => "工作区干净 (Clean)",

        // Workspace Logs
        "workspace.log.rpc_mode" => ">>> 运行模式: RPC 后台服务 (连接 Chappie MCP Broker)...",
        "workspace.log.session_stopped" => ">>> Pi 工作区会话已成功停止",
        "workspace.log.session_exited" => ">>> Pi 工作区会话已结束退出",

        _ => return Cow::Borrowed(key),
    };
    Cow::Borrowed(val)
}

fn translate_en<'a>(key: &'a str) -> Cow<'a, str> {
    let val = match key {
        // Tray
        "tray.show_main_window" => "Show Main Window",
        "tray.exit" => "Exit",
        "tray.tooltip" => "TunnelDock",

        // Common errors
        "error.tunnel_id_and_key_required" => "Both Tunnel ID and API Key are required",
        "error.workspace_not_found" => "Workspace not found",
        "error.workspace_dir_not_found" => "Workspace directory does not exist",
        "error.workspace_path_invalid" => "The specified directory does not exist or is not a valid folder",
        "error.workspace_path_exists" => "This workspace path is already in the list",
        "error.unsupported_platform" => "The current platform does not support this operation",

        // Env Check Names
        "env.name.node" => "Node.js Runtime",
        "env.name.npm" => "npm Package Manager",
        "env.name.git" => "Git Version Control",
        "env.name.cargo" => "Rust / Cargo Toolchain",
        "env.name.cargo_binstall" => "cargo-binstall Fast Installer",
        "env.name.otunnel" => "OpenAI otunnel Client",
        "env.name.pi" => "Pi Coding Agent Runtime",
        "env.name.chappie" => "Chappie MCP Plugin Extension",
        "env.name.tunnel_key" => "OpenAI Tunnel Credentials (tunnelkey.txt)",
        "env.name.tunnel_config" => "Otunnel Configuration (chappie.yaml)",

        // Git Status
        "workspace.git_clean" => "Clean working tree",

        // Workspace Logs
        "workspace.log.rpc_mode" => ">>> Mode: RPC Background Service (Connecting to Chappie MCP Broker)...",
        "workspace.log.session_stopped" => ">>> Pi workspace session has stopped successfully",
        "workspace.log.session_exited" => ">>> Pi workspace session has exited",

        _ => return translate_zh(key), // fallback to zh if key missing in en
    };
    Cow::Borrowed(val)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_locales_correctly() {
        assert_eq!(Locale::from_str("zh-CN"), Locale::ZhCn);
        assert_eq!(Locale::from_str("zh"), Locale::ZhCn);
        assert_eq!(Locale::from_str("en-US"), Locale::EnUs);
        assert_eq!(Locale::from_str("en"), Locale::EnUs);
        assert_eq!(Locale::from_str("unknown"), Locale::ZhCn);
    }

    #[test]
    fn translates_known_keys() {
        assert_eq!(t("zh-CN", "tray.show_main_window"), "显示主界面");
        assert_eq!(t("en-US", "tray.show_main_window"), "Show Main Window");
        assert_eq!(t("en-US", "tray.exit"), "Exit");
        assert_eq!(t("zh-CN", "tray.exit"), "退出");
    }

    #[test]
    fn fallbacks_for_unknown_key() {
        assert_eq!(t("en-US", "non.existent.key"), "non.existent.key");
    }
}
