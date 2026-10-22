package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"speaker_course/config"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

type mediaRoundTripper func(*http.Request) (*http.Response, error)

func (fn mediaRoundTripper) RoundTrip(request *http.Request) (*http.Response, error) {
	return fn(request)
}

func TestCompleteStreamUploadRejectsUnsignedVideoBeforeCallingBunny(t *testing.T) {
	called := false
	service := &MediaService{
		cfg: &config.Config{BunnyStreamID: "673250", BunnyStreamKey: "test-key"},
		httpClient: &http.Client{Transport: mediaRoundTripper(func(*http.Request) (*http.Response, error) {
			called = true
			return nil, errors.New("unexpected request")
		})},
	}
	_, err := service.CompleteStreamUpload(context.Background(), CompleteStreamUploadInput{
		OwnerId: uuid.New(), VideoId: uuid.NewString(), SizeBytes: 100,
		ExpirationTime: time.Now().Add(time.Hour).Unix(), Signature: "invalid",
	})
	if !errors.Is(err, ErrInvalidMedia) || called {
		t.Fatalf("expected invalid credentials without a Bunny request; err=%v called=%v", err, called)
	}
}

func TestWaitForStreamUploadChecksBunnyOriginalAndFailure(t *testing.T) {
	videoID := uuid.NewString()
	service := &MediaService{
		cfg: &config.Config{BunnyStreamID: "673250", BunnyStreamKey: "test-key"},
		httpClient: &http.Client{Transport: mediaRoundTripper(func(request *http.Request) (*http.Response, error) {
			if request.Header.Get("AccessKey") != "test-key" || !strings.HasSuffix(request.URL.Path, videoID) {
				t.Fatalf("unexpected Bunny request: %s", request.URL)
			}
			body := `{"guid":"` + videoID + `","status":2,"hasOriginal":true}`
			return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}, nil
		})},
	}
	if _, err := service.waitForStreamUpload(context.Background(), videoID); err != nil {
		t.Fatalf("uploaded Bunny video should be accepted: %v", err)
	}

	service.httpClient.Transport = mediaRoundTripper(func(*http.Request) (*http.Response, error) {
		body := `{"guid":"` + videoID + `","status":5,"hasOriginal":true}`
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}, nil
	})
	if _, err := service.waitForStreamUpload(context.Background(), videoID); !errors.Is(err, ErrInvalidMedia) {
		t.Fatalf("failed Bunny video should be rejected: %v", err)
	}
}

func TestStreamUploadSignatureExpires(t *testing.T) {
	service := &MediaService{cfg: &config.Config{BunnyStreamID: "673250", BunnyStreamKey: "test-key"}}
	videoID := uuid.NewString()
	expiresAt := time.Now().Add(time.Hour).Unix()
	hash := sha256.Sum256([]byte("673250test-key" + fmt.Sprint(expiresAt) + videoID))
	signature := hex.EncodeToString(hash[:])
	if err := service.validateStreamUploadSignature(videoID, expiresAt, signature); err != nil {
		t.Fatalf("valid upload signature rejected: %v", err)
	}
	if err := service.validateStreamUploadSignature(videoID, time.Now().Add(-time.Second).Unix(), signature); !errors.Is(err, ErrInvalidMedia) {
		t.Fatalf("expired upload signature should be rejected: %v", err)
	}
}

func TestStreamStatusesDoNotTreatUploadStartAsFailure(t *testing.T) {
	videoID := uuid.NewString()
	currentStatus := 6
	availableResolutions := ""
	service := &MediaService{
		cfg: &config.Config{BunnyStreamID: "673250", BunnyStreamKey: "test-key"},
		httpClient: &http.Client{Transport: mediaRoundTripper(func(*http.Request) (*http.Response, error) {
			body := fmt.Sprintf(`{"guid":%q,"status":%d,"encodeProgress":0,"availableResolutions":%q}`, videoID, currentStatus, availableResolutions)
			return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}, nil
		})},
	}
	for _, test := range []struct {
		status      int
		resolutions string
		failed      bool
		playable    bool
	}{
		{0, "", false, false},
		{1, "", false, false},
		{2, "", false, false},
		{2, "360p", false, false},
		{6, "", false, false},
		{7, "", false, false},
		{3, "", false, true},
		{4, "", false, true},
		{5, "", true, false},
		{8, "", true, false},
	} {
		currentStatus = test.status
		availableResolutions = test.resolutions
		result, err := service.GetStreamVideoStatus(context.Background(), videoID)
		if err != nil {
			t.Fatalf("status %d: %v", test.status, err)
		}
		if result.Failed != test.failed || result.Playable != test.playable {
			t.Fatalf("status %d: failed=%v playable=%v", test.status, result.Failed, result.Playable)
		}
	}
}

func TestFailedStreamStatusIncludesBunnyDiagnostic(t *testing.T) {
	videoID := uuid.NewString()
	service := &MediaService{
		cfg: &config.Config{BunnyStreamID: "673250", BunnyStreamKey: "test-key"},
		httpClient: &http.Client{Transport: mediaRoundTripper(func(*http.Request) (*http.Response, error) {
			body := fmt.Sprintf(`{"guid":%q,"status":5,"transcodingMessages":[{"message":"Invalid file. Cannot load original"}]}`, videoID)
			return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}, nil
		})},
	}
	status, err := service.GetStreamVideoStatus(context.Background(), videoID)
	if err != nil {
		t.Fatal(err)
	}
	if !status.Failed || !strings.Contains(status.ErrorMessage, "Bunny не смог прочитать исходный видеофайл") {
		t.Fatalf("unexpected failed status: %+v", status)
	}
}
