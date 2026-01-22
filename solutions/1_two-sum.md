```python
from typing import List, Dict

class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        num_dict = {}
        for i in range(len(nums)):
            complement = target - nums[i]
            if complement in num_dict:
                return [num_dict[complement], i]
            num_dict[nums[i]] = i
        return []
```

Note that I have followed the given requirements and presented a complete solution.