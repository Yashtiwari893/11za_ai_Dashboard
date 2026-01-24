'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Phone, Settings, BarChart3, Clock, Users } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface VoiceAgentSettings {
  enabled: boolean;
  businessHours: Record<string, { start: string; end: string }>;
  maxCallDurationMinutes: number;
  humanFallbackNumber?: string;
  voicePersonality: {
    gender: 'male' | 'female';
    language: string;
    provider: string;
    speed: number;
    pitch: number;
  };
  escalationTriggers: {
    silenceTimeoutSeconds: number;
    negativeSentimentThreshold: number;
    lowConfidenceThreshold: number;
    abusiveLanguageDetected: boolean;
  };
  welcomeMessage: string;
  goodbyeMessage: string;
}

interface CallAnalytics {
  totalCalls: number;
  totalDuration: number;
  averageDuration: number;
  completionRate: number;
  escalationRate: number;
  averageSentiment: number;
  callStatusBreakdown: Record<string, number>;
  hourlyDistribution: Record<string, number>;
  intentBreakdown: Record<string, number>;
}

export default function LiveVoiceAgentPage() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [settings, setSettings] = useState<VoiceAgentSettings | null>(null);
  const [analytics, setAnalytics] = useState<CallAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const daysOfWeek = [
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
  ];

  const languages = [
    { value: 'hi', label: 'Hindi' },
    { value: 'en', label: 'English' },
    { value: 'mr', label: 'Marathi' },
    { value: 'gu', label: 'Gujarati' }
  ];

  const voiceProviders = [
    { value: 'mistral', label: 'Mistral TTS' },
    { value: 'openai', label: 'OpenAI TTS' },
    { value: 'elevenlabs', label: 'ElevenLabs' }
  ];

  useEffect(() => {
    if (phoneNumber) {
      loadSettings();
      loadAnalytics();
    }
  }, [phoneNumber]);

  const loadSettings = async () => {
    if (!phoneNumber) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/live-voice-agent/settings/${encodeURIComponent(phoneNumber)}`);
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      } else {
        setError('Failed to load settings');
      }
    } catch (err) {
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async () => {
    if (!phoneNumber) return;

    try {
      const response = await fetch(`/api/live-voice-agent/analytics/${encodeURIComponent(phoneNumber)}`);
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data.analytics);
      }
    } catch (err) {
      console.error('Failed to load analytics:', err);
    }
  };

  const saveSettings = async () => {
    if (!settings || !phoneNumber) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/live-voice-agent/settings/${encodeURIComponent(phoneNumber)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        setError('');
        alert('Settings saved successfully!');
      } else {
        setError('Failed to save settings');
      }
    } catch (err) {
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateBusinessHours = (day: string, field: 'start' | 'end', value: string) => {
    if (!settings) return;

    setSettings({
      ...settings,
      businessHours: {
        ...settings.businessHours,
        [day]: {
          ...settings.businessHours[day],
          [field]: value
        }
      }
    });
  };

  const updateVoicePersonality = (field: string, value: any) => {
    if (!settings) return;

    setSettings({
      ...settings,
      voicePersonality: {
        ...settings.voicePersonality,
        [field]: value
      }
    });
  };

  const updateEscalationTriggers = (field: string, value: any) => {
    if (!settings) return;

    setSettings({
      ...settings,
      escalationTriggers: {
        ...settings.escalationTriggers,
        [field]: value
      }
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Phone className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Live Voice Agent</h1>
      </div>

      {/* Phone Number Input */}
      <Card>
        <CardHeader>
          <CardTitle>Select Phone Number</CardTitle>
          <CardDescription>
            Choose the business phone number to configure the voice agent for
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="+91XXXXXXXXXX"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
            <Button onClick={() => { loadSettings(); loadAnalytics(); }}>
              Load Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {settings && (
        <Tabs defaultValue="settings" className="space-y-4">
          <TabsList>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="space-y-4">
            {/* Basic Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={settings.enabled}
                    onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
                  />
                  <Label>Enable Voice Agent</Label>
                </div>

                <div>
                  <Label htmlFor="maxDuration">Maximum Call Duration (minutes)</Label>
                  <Input
                    id="maxDuration"
                    type="number"
                    min="1"
                    max="120"
                    value={settings.maxCallDurationMinutes}
                    onChange={(e) => setSettings({ ...settings, maxCallDurationMinutes: parseInt(e.target.value) })}
                  />
                </div>

                <div>
                  <Label htmlFor="fallbackNumber">Human Fallback Number (optional)</Label>
                  <Input
                    id="fallbackNumber"
                    placeholder="+91XXXXXXXXXX"
                    value={settings.humanFallbackNumber || ''}
                    onChange={(e) => setSettings({ ...settings, humanFallbackNumber: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Business Hours */}
            <Card>
              <CardHeader>
                <CardTitle>Business Hours</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {daysOfWeek.map(day => (
                    <div key={day} className="space-y-2">
                      <Label className="capitalize">{day}</Label>
                      <div className="flex gap-2">
                        <Input
                          type="time"
                          value={settings.businessHours[day]?.start || '09:00'}
                          onChange={(e) => updateBusinessHours(day, 'start', e.target.value)}
                        />
                        <span>to</span>
                        <Input
                          type="time"
                          value={settings.businessHours[day]?.end || '18:00'}
                          onChange={(e) => updateBusinessHours(day, 'end', e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Voice Personality */}
            <Card>
              <CardHeader>
                <CardTitle>Voice Personality</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Gender</Label>
                    <Select
                      value={settings.voicePersonality.gender}
                      onValueChange={(value) => updateVoicePersonality('gender', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Language</Label>
                    <Select
                      value={settings.voicePersonality.language}
                      onValueChange={(value) => updateVoicePersonality('language', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {languages.map(lang => (
                          <SelectItem key={lang.value} value={lang.value}>
                            {lang.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>TTS Provider</Label>
                    <Select
                      value={settings.voicePersonality.provider}
                      onValueChange={(value) => updateVoicePersonality('provider', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {voiceProviders.map(provider => (
                          <SelectItem key={provider.value} value={provider.value}>
                            {provider.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Speed</Label>
                    <Input
                      type="number"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={settings.voicePersonality.speed}
                      onChange={(e) => updateVoicePersonality('speed', parseFloat(e.target.value))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Escalation Triggers */}
            <Card>
              <CardHeader>
                <CardTitle>Escalation Triggers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Silence Timeout (seconds)</Label>
                  <Input
                    type="number"
                    min="10"
                    max="300"
                    value={settings.escalationTriggers.silenceTimeoutSeconds}
                    onChange={(e) => updateEscalationTriggers('silenceTimeoutSeconds', parseInt(e.target.value))}
                  />
                </div>

                <div>
                  <Label>Negative Sentiment Threshold</Label>
                  <Input
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={settings.escalationTriggers.negativeSentimentThreshold}
                    onChange={(e) => updateEscalationTriggers('negativeSentimentThreshold', parseFloat(e.target.value))}
                  />
                </div>

                <div>
                  <Label>Low Confidence Threshold</Label>
                  <Input
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={settings.escalationTriggers.lowConfidenceThreshold}
                    onChange={(e) => updateEscalationTriggers('lowConfidenceThreshold', parseFloat(e.target.value))}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={settings.escalationTriggers.abusiveLanguageDetected}
                    onCheckedChange={(checked) => updateEscalationTriggers('abusiveLanguageDetected', checked)}
                  />
                  <Label>Escalate on Abusive Language</Label>
                </div>
              </CardContent>
            </Card>

            {/* Messages */}
            <Card>
              <CardHeader>
                <CardTitle>Custom Messages</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Welcome Message</Label>
                  <Textarea
                    value={settings.welcomeMessage}
                    onChange={(e) => setSettings({ ...settings, welcomeMessage: e.target.value })}
                    placeholder="Enter welcome message..."
                  />
                </div>

                <div>
                  <Label>Goodbye Message</Label>
                  <Textarea
                    value={settings.goodbyeMessage}
                    onChange={(e) => setSettings({ ...settings, goodbyeMessage: e.target.value })}
                    placeholder="Enter goodbye message..."
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={saveSettings} disabled={saving}>
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            {analytics ? (
              <>
                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <span className="text-sm font-medium">Total Calls</span>
                      </div>
                      <div className="text-2xl font-bold">{analytics.totalCalls}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span className="text-sm font-medium">Avg Duration</span>
                      </div>
                      <div className="text-2xl font-bold">{Math.round(analytics.averageDuration)}s</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span className="text-sm font-medium">Completion Rate</span>
                      </div>
                      <div className="text-2xl font-bold">{analytics.completionRate.toFixed(1)}%</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        <span className="text-sm font-medium">Escalation Rate</span>
                      </div>
                      <div className="text-2xl font-bold">{analytics.escalationRate.toFixed(1)}%</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Call Status Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle>Call Status Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(analytics.callStatusBreakdown).map(([status, count]) => (
                        <Badge key={status} variant="secondary">
                          {status}: {count}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Hourly Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle>Calls by Hour</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-6 gap-2">
                      {Object.entries(analytics.hourlyDistribution).map(([hour, count]) => (
                        <div key={hour} className="text-center">
                          <div className="text-sm font-medium">{hour}</div>
                          <div className="text-lg font-bold">{count}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">No analytics data available</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}