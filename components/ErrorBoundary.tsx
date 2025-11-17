"use client"

import React, { Component, ReactNode } from "react"
import { View, Text, StyleSheet, ScrollView } from "react-native"

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.message}>
              {this.state.error?.message || "An unexpected error occurred"}
            </Text>
            {this.state.error?.stack && (
              <Text style={styles.stack}>{this.state.error.stack}</Text>
            )}
            <Text style={styles.hint}>
              Please restart the app. If the problem persists, check your environment variables.
            </Text>
          </ScrollView>
        </View>
      )
    }

    return this.props.children
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    padding: 20,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    color: "#de2f08",
    marginBottom: 16,
  },
  stack: {
    fontSize: 12,
    color: "#888",
    fontFamily: "monospace",
    marginBottom: 16,
  },
  hint: {
    fontSize: 14,
    color: "#fff",
    marginTop: 16,
  },
})

