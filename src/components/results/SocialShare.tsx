'use client';

import React from 'react';
import { X, Share, Copy, MessageCircle } from 'lucide-react';
import type { Supplement } from '@/lib/types';

interface SocialShareProps {
  supplements: Supplement[];
  onClose: () => void;
}

export function SocialShare({ supplements, onClose }: SocialShareProps) {
  const shareText = `Check out these ${supplements.length} supplements I found!`;
  const shareUrl = window.location.href;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
      // TODO: Show toast notification
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const shareToTwitter = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(twitterUrl, '_blank');
  };

  const shareToFacebook = () => {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    window.open(facebookUrl, '_blank');
  };

  const shareToLinkedIn = () => {
    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
    window.open(linkedInUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Share Results</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-3">
          <button
            onClick={copyToClipboard}
            className="w-full flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
          >
            <div className="flex items-center">
              <Copy className="w-5 h-5 mr-3 text-gray-500" />
              <div>
                <div className="font-medium">Copy Link</div>
                <div className="text-sm text-gray-500">Copy to clipboard</div>
              </div>
            </div>
          </button>

          <button
            onClick={shareToTwitter}
            className="w-full flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
          >
            <div className="flex items-center">
              <MessageCircle className="w-5 h-5 mr-3 text-blue-400" />
              <div>
                <div className="font-medium">Share on Twitter</div>
                <div className="text-sm text-gray-500">Share with your followers</div>
              </div>
            </div>
          </button>

          <button
            onClick={shareToFacebook}
            className="w-full flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
          >
            <div className="flex items-center">
              <Share className="w-5 h-5 mr-3 text-blue-600" />
              <div>
                <div className="font-medium">Share on Facebook</div>
                <div className="text-sm text-gray-500">Share with friends</div>
              </div>
            </div>
          </button>

          <button
            onClick={shareToLinkedIn}
            className="w-full flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
          >
            <div className="flex items-center">
              <Share className="w-5 h-5 mr-3 text-blue-700" />
              <div>
                <div className="font-medium">Share on LinkedIn</div>
                <div className="text-sm text-gray-500">Share professionally</div>
              </div>
            </div>
          </button>
        </div>

        <div className="mt-4 pt-4 border-t text-sm text-gray-500">
          Sharing {supplements.length} supplement{supplements.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
} 