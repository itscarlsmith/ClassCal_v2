'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  LifeBuoy,
  BookOpen,
  Keyboard,
  Sparkles,
  ExternalLink,
  Mail,
  MessageSquare,
} from 'lucide-react'

const shortcuts = [
  { key: 'N', description: 'New lesson', modifier: 'Cmd/Ctrl' },
  { key: 'S', description: 'New student', modifier: 'Cmd/Ctrl + Shift' },
  { key: 'H', description: 'New homework', modifier: 'Cmd/Ctrl + Shift' },
  { key: 'K', description: 'Open command palette', modifier: 'Cmd/Ctrl' },
  { key: 'Escape', description: 'Close drawer/modal', modifier: '' },
  { key: '/', description: 'Focus search', modifier: '' },
  { key: '?', description: 'Show keyboard shortcuts', modifier: '' },
]

const changelog = [
  {
    version: '1.0.0',
    date: 'December 2024',
    changes: [
      'Initial release of ClassCal',
      'Calendar with drag-and-drop scheduling',
      'Student management with CRM features',
      'Homework assignments and submissions',
      'Real-time messaging',
      'Credit-based payment system',
      'Automated reminders',
    ],
  },
]

export default function HelpPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Help & Support</h1>
        <p className="text-muted-foreground mt-1">
          Get help using ClassCal and learn about new features
        </p>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <LifeBuoy className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold">Get Support</h3>
              <p className="text-sm text-muted-foreground">Contact our team</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold">Documentation</h3>
              <p className="text-sm text-muted-foreground">Learn the basics</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold">Community</h3>
              <p className="text-sm text-muted-foreground">Join discussions</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Keyboard Shortcuts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Keyboard className="w-5 h-5" />
            Keyboard Shortcuts
          </CardTitle>
          <CardDescription>
            Speed up your workflow with these shortcuts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {shortcuts.map((shortcut) => (
              <div
                key={shortcut.key}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <span className="text-sm">{shortcut.description}</span>
                <div className="flex items-center gap-1">
                  {shortcut.modifier && (
                    <>
                      <kbd className="px-2 py-1 text-xs font-mono bg-background border rounded">
                        {shortcut.modifier}
                      </kbd>
                      <span className="text-muted-foreground">+</span>
                    </>
                  )}
                  <kbd className="px-2 py-1 text-xs font-mono bg-background border rounded">
                    {shortcut.key}
                  </kbd>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* What's New */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            What&apos;s New
          </CardTitle>
          <CardDescription>
            Latest updates and improvements
          </CardDescription>
        </CardHeader>
        <CardContent>
          {changelog.map((release) => (
            <div key={release.version} className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="font-mono">
                  v{release.version}
                </Badge>
                <span className="text-sm text-muted-foreground">{release.date}</span>
              </div>
              <ul className="space-y-2 ml-4">
                {release.changes.map((change, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-primary mt-1.5">•</span>
                    <span className="text-sm">{change}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader>
          <CardTitle>Need More Help?</CardTitle>
          <CardDescription>
            We&apos;re here to help you succeed
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Button variant="outline">
            <Mail className="w-4 h-4 mr-2" />
            Email Support
          </Button>
          <Button variant="outline">
            <ExternalLink className="w-4 h-4 mr-2" />
            Knowledge Base
          </Button>
          <Button variant="outline">
            <MessageSquare className="w-4 h-4 mr-2" />
            Live Chat
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

