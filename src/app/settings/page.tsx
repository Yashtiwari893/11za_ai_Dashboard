"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Moon, Sun, Globe, Bell, Shield, Palette, Bot } from "lucide-react";

export default function SettingsPage() {
  const [darkMode, setDarkMode] = useState(false);
  const [language, setLanguage] = useState("en");
  const [notifications, setNotifications] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  const [voiceSpeed, setVoiceSpeed] = useState("1.0");
  const [voiceLanguage, setVoiceLanguage] = useState("hi");
  const [chatbotPersonality, setChatbotPersonality] = useState("friendly");
  const [maxTokens, setMaxTokens] = useState("1000");

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedDarkMode = localStorage.getItem("darkMode") === "true";
    const savedLanguage = localStorage.getItem("language") || "en";
    const savedNotifications = localStorage.getItem("notifications") !== "false";
    const savedAutoSave = localStorage.getItem("autoSave") !== "false";
    const savedVoiceSpeed = localStorage.getItem("voiceSpeed") || "1.0";

    const savedVoiceLanguage = localStorage.getItem("voiceLanguage") || "hi";
    const savedChatbotPersonality = localStorage.getItem("chatbotPersonality") || "friendly";
    const savedMaxTokens = localStorage.getItem("maxTokens") || "1000";

    setDarkMode(savedDarkMode);
    setLanguage(savedLanguage);
    setNotifications(savedNotifications);
    setAutoSave(savedAutoSave);
    setVoiceSpeed(savedVoiceSpeed);
    setVoiceLanguage(savedVoiceLanguage);
    setChatbotPersonality(savedChatbotPersonality);
    setMaxTokens(savedMaxTokens);

    // Apply dark mode
    if (savedDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  // Handle dark mode toggle
  const handleDarkModeToggle = (checked: boolean) => {
    setDarkMode(checked);
    localStorage.setItem("darkMode", checked.toString());

    if (checked) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  // Save other settings
  const saveSetting = (key: string, value: string | boolean) => {
    localStorage.setItem(key, value.toString());
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#0D163F] dark:text-white">Settings</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-2 text-sm sm:text-base">
          Customize your 11za AI dashboard experience
        </p>
      </div>

      {/* Appearance Settings */}
      <Card className="bg-white/90 backdrop-blur-sm border border-gray-200 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#0D163F] dark:text-white">
            <Palette className="h-4 w-4 sm:h-5 sm:w-5" />
            Appearance
          </CardTitle>
          <CardDescription className="text-[#64748b] dark:text-gray-300">
            Customize the look and feel of your dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label className="text-base text-[#0D163F] dark:text-white">Dark Mode</Label>
              <p className="text-sm text-[#64748b] dark:text-gray-400">
                Toggle between light and dark themes
              </p>
            </div>
            <Switch
              checked={darkMode}
              onCheckedChange={handleDarkModeToggle}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="text-base text-[#0D163F] dark:text-white">Theme Preview</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border border-gray-200 rounded-lg bg-gray-50 dark:bg-gray-800">
              <div className="space-y-2">
                <div className="h-3 bg-[#0D163F] rounded"></div>
                <div className="h-2 bg-gray-300 dark:bg-gray-600 rounded"></div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              </div>
              <div className="flex items-center justify-center">
                <div className={`p-2 rounded-full ${darkMode ? 'bg-[#09AF72]' : 'bg-[#0D163F]'}`}>
                  {darkMode ? <Sun className="h-4 w-4 text-white" /> : <Moon className="h-4 w-4 text-white" />}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Language & Localization */}
      <Card className="bg-white/90 backdrop-blur-sm border border-gray-200 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#0D163F] dark:text-white">
            <Globe className="h-4 w-4 sm:h-5 sm:w-5" />
            Language & Localization
          </CardTitle>
          <CardDescription className="text-[#64748b] dark:text-gray-300">
            Set your preferred language and regional settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="language" className="text-[#0D163F] dark:text-white">Language</Label>
            <Select value={language} onValueChange={(value) => {
              setLanguage(value);
              saveSetting("language", value);
            }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="hi">हिंदी (Hindi)</SelectItem>
                <SelectItem value="gu">ગુજરાતી (Gujarati)</SelectItem>
                <SelectItem value="mr">मराठी (Marathi)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Voice Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Voice & Audio Settings
          </CardTitle>
          <CardDescription>
            Configure voice synthesis and audio preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="voice-speed">Voice Speed</Label>
            <Select value={voiceSpeed} onValueChange={(value) => {
              setVoiceSpeed(value);
              saveSetting("voiceSpeed", value);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select voice speed" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0.5">Very Slow (0.5x)</SelectItem>
                <SelectItem value="0.75">Slow (0.75x)</SelectItem>
                <SelectItem value="1.0">Normal (1.0x)</SelectItem>
                <SelectItem value="1.25">Fast (1.25x)</SelectItem>
                <SelectItem value="1.5">Very Fast (1.5x)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="voice-language">Voice Language</Label>
            <Select value={voiceLanguage} onValueChange={(value) => {
              setVoiceLanguage(value);
              saveSetting("voiceLanguage", value);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select voice language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hi">हिंदी (Hindi)</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="gu">ગુજરાતી (Gujarati)</SelectItem>
                <SelectItem value="mr">मराठी (Marathi)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Chatbot Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Chatbot Settings
          </CardTitle>
          <CardDescription>
            Configure your AI chatbot behavior and responses
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="personality">Chatbot Personality</Label>
            <Select value={chatbotPersonality} onValueChange={(value) => {
              setChatbotPersonality(value);
              saveSetting("chatbotPersonality", value);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select personality" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="friendly">Friendly & Helpful</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="casual">Casual & Conversational</SelectItem>
                <SelectItem value="formal">Formal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="max-tokens">Maximum Response Length</Label>
            <Select value={maxTokens} onValueChange={(value) => {
              setMaxTokens(value);
              saveSetting("maxTokens", value);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select max tokens" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="500">Short (500 tokens)</SelectItem>
                <SelectItem value="1000">Medium (1000 tokens)</SelectItem>
                <SelectItem value="1500">Long (1500 tokens)</SelectItem>
                <SelectItem value="2000">Very Long (2000 tokens)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>
            Manage your notification preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Push Notifications</Label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Receive notifications for new messages and updates
              </p>
            </div>
            <Switch
              checked={notifications}
              onCheckedChange={(checked) => {
                setNotifications(checked);
                saveSetting("notifications", checked);
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            General Settings
          </CardTitle>
          <CardDescription>
            General application preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Auto-save Conversations</Label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Automatically save chat conversations
              </p>
            </div>
            <Switch
              checked={autoSave}
              onCheckedChange={(checked) => {
                setAutoSave(checked);
                saveSetting("autoSave", checked);
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button className="bg-blue-600 hover:bg-blue-700">
          Save All Settings
        </Button>
      </div>
    </div>
  );
}