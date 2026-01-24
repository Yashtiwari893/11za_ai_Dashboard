"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  FileText,
  Phone,
  BarChart3,
  Zap,
  Users,
  Settings,
  Bot,
  Mic,
  Globe,
  CheckCircle,
  TrendingUp,
  Activity
} from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const features = [
    {
      title: "AI Chatbot",
      description: "Intelligent conversational AI with multi-language support",
      icon: Bot,
      href: "/chat",
      color: "bg-gradient-to-br from-[#09AF72] to-[#7bdcb5]",
      status: "Active",
      languages: ["हिंदी", "English", "ગુજરાતી", "मराठी"]
    },
    // {
    //   title: "Voice Notes Processing",
    //   description: "Convert voice messages to text and generate voice responses",
    //   icon: Mic,
    //   href: "/chat",
    //   color: "bg-gradient-to-br from-[#0D163F] to-[#09AF72]",
    //   status: "Active",
    //   features: ["STT", "TTS", "Voice AI"]
    // },
    {
      title: "Document Processing",
      description: "Upload and process PDFs, images with OCR technology",
      icon: FileText,
      href: "/files",
      color: "bg-gradient-to-br from-[#7bdcb5] to-[#09AF72]",
      status: "Active",
      formats: ["PDF", "JPG", "PNG"]
    },
    // {
    //   title: "WhatsApp Integration",
    //   description: "Seamless WhatsApp Business API integration",
    //   icon: Phone,
    //   href: "/chat",
    //   color: "bg-gradient-to-br from-[#0D163F] to-[#7bdcb5]",
    //   status: "Active",
    //   capabilities: ["Auto-respond", "Voice notes", "Media"]
    // },
    {
      title: "Shopify Integration",
      description: "E-commerce platform integration for product support",
      icon: Globe,
      href: "/shopify",
      color: "bg-gradient-to-br from-[#09AF72] to-[#0D163F]",
      status: "Active",
      features: ["Store sync", "Product info", "Orders"]
    },
    // {
    //   title: "Analytics & Reports",
    //   description: "Comprehensive analytics and conversation insights",
    //   icon: BarChart3,
    //   href: "/dashboard",
    //   color: "bg-gradient-to-br from-[#7bdcb5] to-[#0D163F]",
    //   status: "Coming Soon",
    //   metrics: ["Conversations", "Response time", "Satisfaction"]
    // }
  ];

  const stats = [
    { label: "Total Conversations", value: "1,247", icon: MessageSquare, trend: "+12%" },
    { label: "Voice Messages", value: "89", icon: Mic, trend: "+8%" },
    { label: "Active Integrations", value: "3", icon: Zap, trend: "100%" },
    { label: "Response Accuracy", value: "94%", icon: TrendingUp, trend: "+2%" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-green-50">
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 lg:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#0D163F]">
                11za AI Dashboard
              </h1>
              <p className="text-sm sm:text-base lg:text-lg mt-2 text-[#64748b]">
                Intelligent Conversational AI Platform for Business Communication
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <Badge variant="secondary" className="bg-[#09AF72] text-white px-2 sm:px-3 py-1 text-xs sm:text-sm">
                <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                System Online
              </Badge>
              <Button asChild className="bg-[#0D163F] hover:bg-[#09AF72] text-white text-sm">
                <Link href="/settings">
                  <Settings className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                  Settings
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 lg:mb-8">
          {stats.map((stat, index) => (
            <Card key={index} className="bg-white/80 backdrop-blur-sm border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-[#64748b]">
                      {stat.label}
                    </p>
                    <p className="text-2xl sm:text-3xl font-bold mt-1 text-[#0D163F]">
                      {stat.value}
                    </p>
                    <p className="text-xs sm:text-sm mt-1 text-[#09AF72]">
                      {stat.trend} from last month
                    </p>
                  </div>
                  <div className="p-2 sm:p-3 rounded-full bg-[#09AF72]/10">
                    <stat.icon className="w-5 h-5 sm:w-6 sm:h-6 text-[#0D163F]" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Features Grid */}
        <div className="mb-6 lg:mb-8">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-[#0D163F]">
            AI Features & Integrations
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="bg-white/90 backdrop-blur-sm border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 group">
                <CardHeader className="pb-3 sm:pb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2 sm:p-3 rounded-xl ${feature.color} group-hover:scale-110 transition-transform duration-300`}>
                      <feature.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <Badge
                      variant={feature.status === "Active" ? "default" : "secondary"}
                      className={`text-xs ${feature.status === "Active" ? "bg-[#09AF72] text-white" : "bg-gray-200 text-gray-600"}`}
                    >
                      {feature.status}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg sm:text-xl text-[#0D163F]">
                    {feature.title}
                  </CardTitle>
                  <CardDescription className="text-[#64748b] text-sm">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Feature details */}
                    {feature.languages && (
                      <div>
                        <p className="text-sm font-medium mb-2 text-[#0D163F]">
                          Supported Languages:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {feature.languages.map((lang, i) => (
                            <Badge key={i} variant="outline" className="text-xs border-[#09AF72] text-[#09AF72]">
                              {lang}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {feature.features && (
                      <div>
                        <p className="text-sm font-medium mb-2 text-[#0D163F]">
                          Capabilities:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {feature.features.map((feat, i) => (
                            <Badge key={i} variant="outline" className="text-xs border-[#0D163F] text-[#0D163F]">
                              {feat}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {feature.formats && (
                      <div>
                        <p className="text-sm font-medium mb-2 text-[#0D163F]">
                          Supported Formats:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {feature.formats.map((format, i) => (
                            <Badge key={i} variant="outline" className="text-xs border-[#7bdcb5] text-[#0D163F]">
                              {format}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {feature.capabilities && (
                      <div>
                        <p className="text-sm font-medium mb-2 text-[#0D163F]">
                          WhatsApp Features:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {feature.capabilities.map((cap, i) => (
                            <Badge key={i} variant="outline" className="text-xs border-[#09AF72] text-[#09AF72]">
                              {cap}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {feature.metrics && (
                      <div>
                        <p className="text-sm font-medium mb-2 text-[#0D163F]">
                          Analytics:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {feature.metrics.map((metric, i) => (
                            <Badge key={i} variant="outline" className="text-xs border-[#64748b] text-[#64748b]">
                              {metric}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <Button
                      asChild
                      className="w-full mt-4 bg-[#0D163F] hover:bg-[#09AF72] text-white transition-colors duration-300 text-sm"
                    >
                      <Link href={feature.href}>
                        {feature.status === "Active" ? "Open" : "Learn More"}
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <Card className="bg-white/90 backdrop-blur-sm border border-gray-200 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#0D163F] text-lg sm:text-xl">
              <Activity className="w-4 h-4 sm:w-5 sm:h-5" />
              Quick Actions
            </CardTitle>
            <CardDescription className="text-[#64748b]">
              Frequently used features and shortcuts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <Button asChild variant="outline" className="h-14 sm:h-16 flex-col gap-2 border-[#09AF72] text-[#0D163F] hover:bg-[#09AF72] hover:text-white text-sm">
                <Link href="/chat">
                  <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
                  Start Chat
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-14 sm:h-16 flex-col gap-2 border-[#0D163F] text-[#0D163F] hover:bg-[#0D163F] hover:text-white text-sm">
                <Link href="/files">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                  Upload Files
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-14 sm:h-16 flex-col gap-2 border-[#7bdcb5] text-[#0D163F] hover:bg-[#7bdcb5] text-sm">
                <Link href="/settings">
                  <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
                  Configure AI
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}