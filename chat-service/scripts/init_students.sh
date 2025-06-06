#!/bin/bash
# chat-service/scripts/init_students.sh

echo "🎓 Initializing student documents..."
python /app/scripts/initialize_metadata.py
echo "✅ Student initialization complete!"