"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Moon, Sun, Globe, Bell, Shield, Palette, Bot, Phone, Plus, Trash2, CheckCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { ProtectedRoute } from "@/components/protected-route";

interface PhoneGroup {
  id: string;
  phone_number: string;
  intent: string;
  system_prompt: string;
  auth_token: string;
  origin: string;
}

interface LocalSettings {
  darkMode: boolean;
  language: string;
  notifications: boolean;
  autoSave: boolean;
}

function SettingsPageContent() {
  // Local UI Settings
  const [darkMode, setDarkMode] = useState(false);
  const [language, setLanguage] = useState("en");
  const [notifications, setNotifications] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  const [localLoading, setLocalLoading] = useState(true);

  // Phone Settings (Database)
  const [phoneGroups, setPhoneGroups] = useState<PhoneGroup[]>([]);
  const [phoneLoading, setPhoneLoading] = useState(true);
  const [selectedPhone, setSelectedPhone] = useState<string>("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Form states for selected phone
  const [editPhoneNumber, setEditPhoneNumber] = useState("");
  const [editIntent, setEditIntent] = useState("");
  const [editSystemPrompt, setEditSystemPrompt] = useState("");
  const [editAuthToken, setEditAuthToken] = useState("");
  const [editOrigin, setEditOrigin] = useState("");
  const [newPhoneNumber, setNewPhoneNumber] = useState("");
  const [showNewPhoneForm, setShowNewPhoneForm] = useState(false);

  // Load local settings from localStorage on mount
  useEffect(() => {
    const savedDarkMode = localStorage.getItem("darkMode") === "true";
    const savedLanguage = localStorage.getItem("language") || "en";
    const savedNotifications = localStorage.getItem("notifications") !== "false";
    const savedAutoSave = localStorage.getItem("autoSave") !== "false";

    setDarkMode(savedDarkMode);
    setLanguage(savedLanguage);
    setNotifications(savedNotifications);
    setAutoSave(savedAutoSave);
    setLocalLoading(false);

    if (savedDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  // Fetch phone settings from database
  useEffect(() => {
    fetchPhoneSettings();
  }, []);

  async function fetchPhoneSettings() {
    try {
      setPhoneLoading(true);
      const { data, error } = await supabase
        .from("phone_settings")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setPhoneGroups(data || []);
      if (data && data.length > 0 && !selectedPhone) {
        setSelectedPhone(data[0].phone_number);
        loadPhoneSettings(data[0]);
      }
    } catch (error) {
      console.error("Error fetching phone settings:", error);
    } finally {
      setPhoneLoading(false);
    }
  }

  function loadPhoneSettings(phone: PhoneGroup) {
    setEditPhoneNumber(phone.phone_number);
    setEditIntent(phone.intent || "");
    setEditSystemPrompt(phone.system_prompt || "");
    setEditAuthToken(phone.auth_token || "");
    setEditOrigin(phone.origin || "");
  }

  const handleSelectPhone = (phoneNumber: string) => {
    setSelectedPhone(phoneNumber);
    const phone = phoneGroups.find(p => p.phone_number === phoneNumber);
    if (phone) {
      loadPhoneSettings(phone);
    }
  };

  const handleSavePhoneSettings = async () => {
    if (!editPhoneNumber.trim()) {
      alert("Phone number is required");
      return;
    }

    setSavingPhone(true);
    try {
      const { error } = await supabase
        .from("phone_settings")
        .update({
          intent: editIntent.trim() || null,
          system_prompt: editSystemPrompt.trim() || null,
          auth_token: editAuthToken.trim() || null,
          origin: editOrigin.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq("phone_number", editPhoneNumber);

      if (error) throw error;

      setSuccessMessage("✓ Phone settings saved successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);
      
      // Refresh the list
      await fetchPhoneSettings();
    } catch (error) {
      console.error("Error saving phone settings:", error);
      alert(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setSavingPhone(false);
    }
  };

  const handleAddNewPhone = async () => {
    if (!newPhoneNumber.trim()) {
      alert("Phone number is required");
      return;
    }

    setSavingPhone(true);
    try {
      const { error } = await supabase
        .from("phone_settings")
        .insert({
          phone_number: newPhoneNumber.trim(),
          intent: "New phone number",
          system_prompt: "",
          auth_token: "",
          origin: "",
        });

      if (error) throw error;

      setNewPhoneNumber("");
      setShowNewPhoneForm(false);
      setSuccessMessage("✓ New phone number added!");
      setTimeout(() => setSuccessMessage(""), 3000);
      
      await fetchPhoneSettings();
    } catch (error) {
      console.error("Error adding phone number:", error);
      alert(error instanceof Error ? error.message : "Failed to add phone number");
    } finally {
      setSavingPhone(false);
    }
  };

  const handleDeletePhone = async (phoneNumber: string) => {
    if (!confirm("Delete this phone number and all associated data?")) return;

    try {
      const { error } = await supabase
        .from("phone_settings")
        .delete()
        .eq("phone_number", phoneNumber);

      if (error) throw error;

      setSuccessMessage("✓ Phone number deleted!");
      setTimeout(() => setSuccessMessage(""), 3000);
      
      await fetchPhoneSettings();
      setSelectedPhone("");
    } catch (error) {
      console.error("Error deleting phone number:", error);
      alert(error instanceof Error ? error.message : "Failed to delete phone number");
    }
  };

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

  // Save local settings
  const saveSetting = (key: string, value: string | boolean) => {
    localStorage.setItem(key, value.toString());
  };

  if (localLoading) {
    return <div className="p-8 text-center">Loading settings...</div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#0D163F] dark:text-white">Settings</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-2 text-sm sm:text-base">
          Manage your 11za AI dashboard and phone configurations
        </p>
      </div>

      {successMessage && (
        <Card className="bg-green-50 border border-green-200">
          <CardContent className="p-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-green-800">{successMessage}</span>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="phone" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="phone">Phone Settings</TabsTrigger>
          <TabsTrigger value="local">Local Preferences</TabsTrigger>
        </TabsList>

        {/* PHONE SETTINGS TAB */}
        <TabsContent value="phone" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Phone List */}
            <Card className="bg-white/90 backdrop-blur-sm border border-gray-200 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#0D163F]">
                  <Phone className="h-4 w-4" />
                  Phone Numbers
                </CardTitle>
                <CardDescription>
                  {phoneLoading ? "Loading..." : `${phoneGroups.length} configured`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {phoneLoading ? (
                  <p className="text-sm text-gray-500">Loading phone numbers...</p>
                ) : phoneGroups.length > 0 ? (
                  <>
                    {phoneGroups.map(phone => (
                      <button
                        key={phone.phone_number}
                        onClick={() => handleSelectPhone(phone.phone_number)}
                        className={`w-full text-left px-3 py-2 rounded-md transition-colors text-sm ${
                          selectedPhone === phone.phone_number
                            ? "bg-[#0D163F] text-white"
                            : "bg-gray-100 hover:bg-gray-200"
                        }`}
                      >
                        {phone.phone_number}
                      </button>
                    ))}
                  </>
                ) : (
                  <p className="text-sm text-gray-500">No phone numbers yet</p>
                )}

                {showNewPhoneForm ? (
                  <div className="space-y-2 pt-2 border-t">
                    <Input
                      placeholder="New phone number"
                      value={newPhoneNumber}
                      onChange={(e) => setNewPhoneNumber(e.target.value)}
                      className="text-sm"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={handleAddNewPhone}
                        disabled={savingPhone}
                        className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700"
                      >
                        {savingPhone ? "Adding..." : "Add"}
                      </Button>
                      <Button
                        onClick={() => setShowNewPhoneForm(false)}
                        variant="outline"
                        className="flex-1 h-8 text-xs"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    onClick={() => setShowNewPhoneForm(true)}
                    className="w-full h-8 text-xs bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    New Phone
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Phone Details */}
            <div className="lg:col-span-2 space-y-4">
              {selectedPhone ? (
                <>
                  <Card className="bg-white/90 backdrop-blur-sm border border-gray-200 shadow-lg">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-[#0D163F]">{editPhoneNumber}</CardTitle>
                          <CardDescription>Configure this phone number</CardDescription>
                        </div>
                        <Button
                          onClick={() => handleDeletePhone(editPhoneNumber)}
                          variant="destructive"
                          size="sm"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardHeader>
                  </Card>

                  <Card className="bg-white/90 backdrop-blur-sm border border-gray-200 shadow-lg">
                    <CardHeader>
                      <CardTitle className="text-lg text-[#0D163F]">Intent/Purpose</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Input
                        placeholder="E.g., Customer service chatbot"
                        value={editIntent}
                        onChange={(e) => setEditIntent(e.target.value)}
                      />
                      <p className="text-xs text-gray-500 mt-2">Describe this phone's purpose</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-white/90 backdrop-blur-sm border border-gray-200 shadow-lg">
                    <CardHeader>
                      <CardTitle className="text-lg text-[#0D163F]">System Prompt</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <textarea
                        value={editSystemPrompt}
                        onChange={(e) => setEditSystemPrompt(e.target.value)}
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="System instructions for the chatbot..."
                      />
                      <p className="text-xs text-gray-500 mt-2">Customize chatbot behavior</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-white/90 backdrop-blur-sm border border-gray-200 shadow-lg">
                    <CardHeader>
                      <CardTitle className="text-lg text-[#0D163F]">11za Credentials</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label className="text-sm">Auth Token</Label>
                        <Input
                          placeholder="Your 11za authentication token"
                          value={editAuthToken}
                          onChange={(e) => setEditAuthToken(e.target.value)}
                          type="password"
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Origin</Label>
                        <Input
                          placeholder="https://example.com/"
                          value={editOrigin}
                          onChange={(e) => setEditOrigin(e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Button
                    onClick={handleSavePhoneSettings}
                    disabled={savingPhone}
                    className="w-full bg-green-600 hover:bg-green-700 h-10 text-base"
                  >
                    {savingPhone ? "Saving..." : "✓ Save Phone Settings"}
                  </Button>
                </>
              ) : (
                <Card className="bg-gray-50">
                  <CardContent className="p-8 text-center">
                    <p className="text-gray-500">Select a phone number to configure</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* LOCAL PREFERENCES TAB */}
        <TabsContent value="local" className="space-y-4">
          {/* Appearance Settings */}
          <Card className="bg-white/90 backdrop-blur-sm border border-gray-200 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#0D163F]">
                <Palette className="h-4 w-4" />
                Appearance
              </CardTitle>
              <CardDescription>Customize the look and feel</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base text-[#0D163F]">Dark Mode</Label>
                  <p className="text-sm text-gray-500">Toggle between light and dark themes</p>
                </div>
                <Switch
                  checked={darkMode}
                  onCheckedChange={handleDarkModeToggle}
                />
              </div>
            </CardContent>
          </Card>

          {/* Language Settings */}
          <Card className="bg-white/90 backdrop-blur-sm border border-gray-200 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#0D163F]">
                <Globe className="h-4 w-4" />
                Language & Localization
              </CardTitle>
              <CardDescription>Set your preferred language</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-[#0D163F]">Language</Label>
                <Select
                  value={language}
                  onValueChange={(value) => {
                    setLanguage(value);
                    saveSetting("language", value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
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

          {/* Notifications */}
          <Card className="bg-white/90 backdrop-blur-sm border border-gray-200 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#0D163F]">
                <Bell className="h-4 w-4" />
                Notifications
              </CardTitle>
              <CardDescription>Manage notification preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Push Notifications</Label>
                  <p className="text-sm text-gray-500">Receive notifications for updates</p>
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
          <Card className="bg-white/90 backdrop-blur-sm border border-gray-200 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#0D163F]">
                <Shield className="h-4 w-4" />
                General Settings
              </CardTitle>
              <CardDescription>General preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Auto-save Conversations</Label>
                  <p className="text-sm text-gray-500">Automatically save chat conversations</p>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <SettingsPageContent />
    </ProtectedRoute>
  );
}