package com.mosharrof.agent.execution

import org.junit.Assert.assertEquals
import org.junit.Test

class AppPackageCommandParserTest {
    @Test fun asksForApkForGenericInstallCommand() {
        assertEquals(AppPackageCommand.PickApk, AppPackageCommandParser.parse("অ্যাপ ইনস্টল করো"))
        assertEquals(AppPackageCommand.PickApk, AppPackageCommandParser.parse("install apk"))
    }
    @Test fun searchesStoreForNamedInstallTarget() {
        assertEquals(AppPackageCommand.SearchStore("Telegram"), AppPackageCommandParser.parse("install Telegram"))
        assertEquals(AppPackageCommand.SearchStore("YouTube Music"), AppPackageCommandParser.parse("ইনস্টল করুন YouTube Music"))
    }
    @Test fun requiresExplicitTargetForUninstall() {
        assertEquals(AppPackageCommand.AskUninstallTarget, AppPackageCommandParser.parse("uninstall app"))
        assertEquals(AppPackageCommand.Uninstall("YouTube"), AppPackageCommandParser.parse("uninstall YouTube"))
        assertEquals(AppPackageCommand.Uninstall("YouTube"), AppPackageCommandParser.parse("YouTube আনইনস্টল করুন"))
    }
    @Test fun rejectsEmptyOversizedAndUnrelatedCommands() {
        assertEquals(AppPackageCommand.NotRecognized, AppPackageCommandParser.parse(""))
        assertEquals(AppPackageCommand.NotRecognized, AppPackageCommandParser.parse("x".repeat(241)))
        assertEquals(AppPackageCommand.NotRecognized, AppPackageCommandParser.parse("open YouTube"))
    }
}
