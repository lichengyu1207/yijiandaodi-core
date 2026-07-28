from rest_framework import serializers
from .system_models import (
    PrivacyAgreement,
    UserConsentRecord,
    IMMessage,
    IMAutoReply,
    VoiceAssistantConfig,
)


class PrivacyAgreementSerializer(serializers.ModelSerializer):
    agreement_type_display = serializers.CharField(source='get_agreement_type_display', read_only=True)

    class Meta:
        model = PrivacyAgreement
        fields = [
            'id', 'title', 'agreement_type', 'agreement_type_display',
            'content', 'version', 'is_active', 'is_required',
            'effective_date', 'created_by', 'created_at', 'updated_at',
        ]


class UserConsentSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()
    username = serializers.CharField(required=False, default='')
    agreement_type = serializers.CharField(max_length=20)
    agreement_version = serializers.CharField(max_length=20)
    status = serializers.ChoiceField(choices=['agreed', 'declined'])

    def validate(self, attrs):
        try:
            PrivacyAgreement.objects.get(
                agreement_type=attrs['agreement_type'],
                version=attrs['agreement_version'],
                is_active=True,
            )
        except PrivacyAgreement.DoesNotExist:
            raise serializers.ValidationError('协议不存在或已失效')
        return attrs


class UserConsentRecordSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = UserConsentRecord
        fields = [
            'id', 'user_id', 'username', 'agreement_type',
            'agreement_version', 'status', 'status_display',
            'ip_address', 'consented_at',
        ]
        read_only_fields = ['id', 'consented_at']


class IMMessageSerializer(serializers.ModelSerializer):
    sender_type_display = serializers.CharField(source='get_sender_type_display', read_only=True)
    message_type_display = serializers.CharField(source='get_message_type_display', read_only=True)

    class Meta:
        model = IMMessage
        fields = [
            'id', 'session_id', 'sender_type', 'sender_type_display',
            'user_id', 'agent_id', 'message_type', 'message_type_display',
            'content', 'file_url', 'is_read', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class IMSendMessageSerializer(serializers.Serializer):
    session_id = serializers.CharField(max_length=64, required=False)
    content = serializers.CharField(max_length=5000)
    message_type = serializers.ChoiceField(choices=['text', 'image', 'file'], default='text')
    file_url = serializers.URLField(required=False, allow_blank=True)


class IMAutoReplySerializer(serializers.ModelSerializer):
    trigger_type_display = serializers.CharField(source='get_trigger_type_display', read_only=True)

    class Meta:
        model = IMAutoReply
        fields = [
            'id', 'trigger_type', 'trigger_type_display', 'keyword',
            'reply_content', 'priority', 'is_enabled', 'match_count',
            'created_at', 'updated_at',
        ]


class VoiceConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = VoiceAssistantConfig
        fields = ['id', 'config_key', 'config_value', 'description', 'updated_at']
