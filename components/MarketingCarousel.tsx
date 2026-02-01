"use client"

import { useState, useRef, useMemo } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
} from "react-native"
import { useRouter } from "expo-router"
import { useTheme } from "../lib/theme-context"
import { typography, spacing } from "../lib/theme"
import { useMarketingStories } from "../lib/useMarketingStories"

const SCREEN_WIDTH = Dimensions.get("window").width
const CARD_WIDTH = SCREEN_WIDTH - 96 // 48px padding each side + 48px peek
const CARD_SPACING = 12
const CARD_PEEK = 48

interface MarketingCard {
  id: string
  storyId: string
  title: string
  subtitle: string
  imageSource: any // require() image
}

interface MarketingCarouselProps {
  cards: MarketingCard[]
  hideSeen?: boolean
}

export function MarketingCarousel({ cards, hideSeen = true }: MarketingCarouselProps) {
  const router = useRouter()
  const { colors, isDark } = useTheme()
  const { isStorySeen, markStoryAsSeen, getVisibleStories } = useMarketingStories()
  const scrollViewRef = useRef<ScrollView>(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  // Theme 2 colors
  const theme2Colors = useMemo(() => {
    if (isDark) {
      return {
        beige: "#000000",
        cream: "#000000",
        white: "#E8E0D5",
        text: "#F5F0EA",
        textSecondary: "#A0A0A0",
        accent: "#D35E3C",
      }
    } else {
      return {
        beige: "#E8E0D5",
        cream: "#F5F0EA",
        white: "#FFFFFF",
        text: "#000000",
        textSecondary: "#404040",
        accent: "#D35E3C",
      }
    }
  }, [isDark])

  // Filter out seen stories if hideSeen is true
  const visibleCards = useMemo(() => {
    if (!hideSeen) return cards
    return cards.filter((card) => !isStorySeen(card.storyId))
  }, [cards, hideSeen, isStorySeen])

  // Don't render if no visible cards
  if (visibleCards.length === 0) {
    return null
  }

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x
    const index = Math.round(offsetX / (CARD_WIDTH + CARD_SPACING))
    setCurrentIndex(index)
  }

  const handleCardPress = (card: MarketingCard) => {
    router.push({
      pathname: "/(main)/modals/marketing-story",
      params: {
        storyId: card.storyId,
        returnTo: "/(main)/home",
      },
    })
  }

  const handleMarkAsSeen = (e: any, card: MarketingCard) => {
    e.stopPropagation()
    markStoryAsSeen(card.storyId)
  }

  const currentCard = visibleCards[currentIndex]

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image
            source={require("../assets/images/icon-ios.png")}
            style={styles.headerIcon}
            resizeMode="contain"
          />
          <Text style={[styles.headerTitle, { color: theme2Colors.text }]} numberOfLines={1}>
            Welcome to Good Times
          </Text>
        </View>
        {hideSeen && currentCard && !isStorySeen(currentCard.storyId) && (
          <TouchableOpacity
            style={[
              styles.dismissButton,
              {
                backgroundColor: isDark ? "#000000" : theme2Colors.white,
                borderColor: isDark ? "#000000" : theme2Colors.text,
              },
            ]}
            onPress={(e) => handleMarkAsSeen(e, currentCard)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.dismissText,
                {
                  color: isDark ? "#FFFFFF" : theme2Colors.text,
                },
              ]}
            >
              Dismiss
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Carousel */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + CARD_SPACING}
        snapToAlignment="start"
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
      >
        {visibleCards.map((card, index) => (
          <TouchableOpacity
            key={card.id}
            style={[
              styles.card,
              {
                backgroundColor: theme2Colors.cream,
                width: CARD_WIDTH,
                marginRight: index < visibleCards.length - 1 ? CARD_SPACING : 0,
              },
            ]}
            onPress={() => handleCardPress(card)}
            activeOpacity={0.9}
          >
            {/* Card Image */}
            <View style={styles.cardImageContainer}>
              <Image
                source={card.imageSource}
                style={styles.cardImage}
                resizeMode="cover"
              />
              {/* Texture overlay */}
              <View style={styles.cardTexture} pointerEvents="none">
                <Image
                  source={require("../assets/images/texture.png")}
                  style={styles.cardTextureImage}
                  resizeMode="cover"
                />
              </View>
            </View>

            {/* Card Content */}
            <View style={styles.cardContent}>
              <Text style={[styles.cardSubtitle, { color: theme2Colors.textSecondary }]}>
                {card.subtitle}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Page Indicators */}
      {visibleCards.length > 1 && (
        <View style={styles.indicators}>
          {visibleCards.map((_, index) => (
            <View
              key={index}
              style={[
                styles.indicator,
                {
                  width: index === currentIndex ? 24 : 8,
                  backgroundColor:
                    index === currentIndex ? theme2Colors.text : theme2Colors.textSecondary,
                  opacity: index === currentIndex ? 1 : 0.5,
                },
              ]}
            />
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.lg,
    marginHorizontal: spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  headerIcon: {
    width: 24,
    height: 24,
    marginRight: spacing.sm,
    borderRadius: 8,
  },
  headerTitle: {
    fontFamily: "Roboto-Bold",
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
  dismissButton: {
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 16,
  },
  dismissText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: "600",
  },
  scrollView: {
    marginHorizontal: -spacing.lg, // Negative margin to allow peek
  },
  scrollContent: {
    paddingHorizontal: spacing.lg, // Restore padding for first/last cards
  },
  card: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#404040", // Will be overridden by theme
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  cardImageContainer: {
    width: "100%",
    height: 280,
    position: "relative",
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  cardTexture: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.4,
    zIndex: 999,
    pointerEvents: "none",
  },
  cardTextureImage: {
    width: "100%",
    height: "100%",
  },
  cardContent: {
    padding: spacing.lg,
  },
  cardSubtitle: {
    ...typography.body,
    fontSize: 14,
  },
  indicators: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  indicator: {
    height: 4,
    borderRadius: 2,
  },
})
