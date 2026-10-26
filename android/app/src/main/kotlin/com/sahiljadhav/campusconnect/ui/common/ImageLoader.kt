package com.sahiljadhav.campusconnect.ui.common

import android.graphics.BitmapFactory
import android.util.Base64
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.sp
import coil.compose.SubcomposeAsyncImage
import coil.request.ImageRequest

@Composable
fun CampusImage(
    imageUrl: String?,
    fallbackEmoji: String,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Crop
) {
    val trimmedUrl = imageUrl?.trim()

    if (trimmedUrl.isNullOrEmpty()) {
        FallbackEmojiBox(emoji = fallbackEmoji, modifier = modifier)
        return
    }

    if (trimmedUrl.startsWith("data:")) {
        val bitmap = remember(trimmedUrl) {
            try {
                val base64Data = trimmedUrl.substringAfter("base64,")
                val decodedBytes = Base64.decode(base64Data, Base64.DEFAULT)
                BitmapFactory.decodeByteArray(decodedBytes, 0, decodedBytes.size)
            } catch (e: Exception) {
                null
            }
        }

        if (bitmap != null) {
            Image(
                bitmap = bitmap.asImageBitmap(),
                contentDescription = contentDescription,
                modifier = modifier,
                contentScale = contentScale
            )
        } else {
            FallbackEmojiBox(emoji = fallbackEmoji, modifier = modifier)
        }
        return
    }

    // Network image via Coil
    SubcomposeAsyncImage(
        model = ImageRequest.Builder(LocalContext.current)
            .data(trimmedUrl)
            .crossfade(true)
            .build(),
        contentDescription = contentDescription,
        modifier = modifier,
        contentScale = contentScale,
        loading = {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(MaterialTheme.colorScheme.surfaceVariant),
                contentAlignment = Alignment.Center
            ) {
                Text(text = fallbackEmoji, fontSize = 24.sp)
            }
        },
        error = {
            FallbackEmojiBox(emoji = fallbackEmoji, modifier = Modifier.fillMaxSize())
        }
    )
}

@Composable
private fun FallbackEmojiBox(
    emoji: String,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier.background(MaterialTheme.colorScheme.surfaceVariant),
        contentAlignment = Alignment.Center
    ) {
        Text(text = emoji, fontSize = 28.sp)
    }
}
