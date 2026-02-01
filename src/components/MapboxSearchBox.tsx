import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Keyboard } from 'react-native';
import { TextInput, ActivityIndicator, Text, IconButton } from 'react-native-paper';
import { searchPlaces } from '../lib/mapboxSearch';
import { SearchResult } from '../types/mapbox';
import { colors, spacing } from '../styles/theme';

interface MapboxSearchBoxProps {
  placeholder?: string;
  onSelectResult: (result: SearchResult) => void;
  proximity?: [number, number]; // Bias results near this location
  initialValue?: string;
  disabled?: boolean;
}

const MapboxSearchBox: React.FC<MapboxSearchBoxProps> = ({
  placeholder = 'Search by address or postcode',
  onSelectResult,
  proximity,
  initialValue = '',
  disabled = false,
}) => {
  const [input, setInput] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const sessionToken = useRef(`session-${Date.now()}`);

  useEffect(() => {
    if (initialValue) {
      setInput(initialValue);
    }
  }, [initialValue]);

  const handleSearch = async (query: string) => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const results = await searchPlaces(query.trim(), proximity);
      setSuggestions(results);
      setShowDropdown(results.length > 0);
    } catch (err) {
      console.error('Search error:', err);
      setError('Search failed. Please try again.');
      setSuggestions([]);
      setShowDropdown(false);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (text: string) => {
    setInput(text);

    // Clear previous timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Debounce search by 300ms
    debounceTimer.current = setTimeout(() => {
      handleSearch(text);
    }, 300);
  };

  const handleSelectResult = (result: SearchResult) => {
    setInput(result.place_name);
    setSuggestions([]);
    setShowDropdown(false);
    Keyboard.dismiss();
    onSelectResult(result);
    // Generate new session token for next search session
    sessionToken.current = `session-${Date.now()}`;
  };

  const handleClear = () => {
    setInput('');
    setSuggestions([]);
    setShowDropdown(false);
    setError(null);
  };

  return (
    <View style={styles.container}>
      <TextInput
        placeholder={placeholder}
        value={input}
        onChangeText={handleInputChange}
        mode="outlined"
        disabled={disabled}
        style={styles.input}
        right={
          <>
            {loading && <TextInput.Icon icon={() => <ActivityIndicator size={20} />} />}
            {!loading && input.length > 0 && (
              <TextInput.Icon icon="close" onPress={handleClear} />
            )}
            {!loading && input.length === 0 && <TextInput.Icon icon="magnify" />}
          </>
        }
      />
      {error && (
        <Text style={styles.errorText} variant="bodySmall">
          {error}
        </Text>
      )}
      {showDropdown && suggestions.length > 0 && (
        <View style={styles.dropdown}>
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.suggestionItem}
                onPress={() => handleSelectResult(item)}
                accessible
                accessibilityLabel={`Select ${item.place_name}`}
                accessibilityRole="button"
              >
                <IconButton icon="map-marker" size={20} style={styles.suggestionIcon} />
                <View style={styles.suggestionTextContainer}>
                  <Text variant="bodyMedium" style={styles.suggestionText}>
                    {item.text}
                  </Text>
                  <Text variant="bodySmall" style={styles.suggestionSubtext}>
                    {item.place_name}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            style={styles.suggestionsList}
            keyboardShouldPersistTaps="handled"
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1000,
  },
  input: {
    backgroundColor: '#fff',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginTop: spacing(0.5),
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    maxHeight: 300,
    zIndex: 1001,
  },
  suggestionsList: {
    maxHeight: 300,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing(1.5),
    borderBottomWidth: 1,
    borderBottomColor: colors.muted + '20',
  },
  suggestionIcon: {
    margin: 0,
  },
  suggestionTextContainer: {
    flex: 1,
    marginLeft: spacing(1),
  },
  suggestionText: {
    fontWeight: '600',
    color: '#000',
  },
  suggestionSubtext: {
    color: colors.muted,
    marginTop: 2,
  },
  errorText: {
    color: '#d32f2f',
    marginTop: spacing(0.5),
    marginLeft: spacing(1),
  },
});

export default MapboxSearchBox;
