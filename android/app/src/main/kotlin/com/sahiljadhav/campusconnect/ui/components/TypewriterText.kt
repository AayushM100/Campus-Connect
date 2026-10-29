package com.sahiljadhav.campusconnect.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import kotlinx.coroutines.delay

/**
 * Native Jetpack Compose Typewriter Text inspired by 21st.dev interaction patterns.
 * Types characters progressively with an animated blinking cursor.
 * Tapping the text immediately completes the animation for instant readability.
 */
@Composable
fun TypewriterText(
    text: String,
    modifier: Modifier = Modifier,
    style: TextStyle = LocalTextStyle.current,
    color: Color = Color.Unspecified,
    charDelayMs: Long = 35L,
    startDelayMs: Long = 100L,
    showCursor: Boolean = true,
    cursorColor: Color = color,
    onAnimationEnd: () -> Unit = {}
) {
    var displayedCharCount by remember(text) { mutableIntStateOf(0) }
    var isFinished by remember(text) { mutableStateOf(false) }

    // Blinking cursor animation
    val cursorAlpha = remember { Animatable(1f) }
    LaunchedEffect(isFinished) {
        if (!isFinished || showCursor) {
            cursorAlpha.animateTo(
                targetValue = 0f,
                animationSpec = infiniteRepeatable(
                    animation = tween(durationMillis = 500, easing = LinearEasing),
                    repeatMode = RepeatMode.Reverse
                )
            )
        }
    }

    // Typewriter effect coroutine
    LaunchedEffect(text) {
        displayedCharCount = 0
        isFinished = false
        delay(startDelayMs)

        for (i in 1..text.length) {
            displayedCharCount = i
            delay(charDelayMs)
        }
        isFinished = true
        onAnimationEnd()
    }

    Row(
        modifier = modifier.clickable(
            interactionSource = remember { MutableInteractionSource() },
            indication = null
        ) {
            // Tap to instantly reveal full text for accessibility
            displayedCharCount = text.length
            isFinished = true
        },
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = text.take(displayedCharCount),
            style = style,
            color = color
        )
        if (showCursor && (!isFinished || displayedCharCount < text.length)) {
            Text(
                text = "▍",
                style = style,
                color = cursorColor,
                modifier = Modifier.alpha(cursorAlpha.value)
            )
        }
    }
}
