#!/bin/bash

# Simple script to approve and merge pull requests
# Usage: ./merge-pr.sh [PR_NUMBER]

echo "🔍 Checking for pull requests..."

# Check if PR number is provided
if [ $# -eq 0 ]; then
    echo "📋 Available pull requests:"
    gh pr list
    echo ""
    echo "Usage: $0 [PR_NUMBER]"
    echo "Example: $0 1"
    exit 1
fi

PR_NUMBER=$1

echo "🔍 Reviewing PR #$PR_NUMBER..."
echo ""

# Show PR details
echo "📄 PR Details:"
gh pr view $PR_NUMBER
echo ""

# Show the diff
echo "📝 Changes:"
gh pr diff $PR_NUMBER
echo ""

# Ask for confirmation
read -p "❓ Do you want to approve and merge this PR? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "✅ Approving PR #$PR_NUMBER..."
    gh pr review $PR_NUMBER --approve --body "LGTM! Great work on implementing the features. Merging now."
    
    echo "🔄 Merging PR #$PR_NUMBER..."
    gh pr merge $PR_NUMBER --squash --delete-branch
    
    echo "🎉 PR #$PR_NUMBER has been successfully merged!"
    echo "🔄 Updating local repository..."
    git pull origin main
    
    echo "✅ All done! The changes have been merged and your local repo is updated."
else
    echo "❌ Merge cancelled."
fi 